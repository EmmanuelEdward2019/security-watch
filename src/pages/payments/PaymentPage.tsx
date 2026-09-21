import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard, ArrowRight, ShieldCheck, AlertTriangle, Lock } from 'lucide-react';
import { Button, Card, CardHeader, CardContent, Spinner, EmptyState } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
  startPayment,
  fetchServicePrices,
  awaitPaymentSettlement,
  getPaymentByReference,
  formatCurrency,
} from '@/services/paymentService';
import { PRICE_MODULE_LABELS, type ServicePrice, type PriceModule, type Payment } from '@/types';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';
import { goToCheckout } from '@/lib/paymentRedirect';
import { fetchCaseEngagements, type CaseEngagement } from '@/services/engagementService';
import { purchasableServices, openEngagementFor, amountDue } from '@/lib/servicePurchase';

/**
 * Checkout.
 *
 * The user picks a service, not an amount. The old page asked them to type
 * whatever figure they liked into a free-text field, opened the Paystack inline
 * popup, and then wrote `status: 'completed'` into the database from the
 * browser — so the record was self-declared and the amount was whatever the
 * payer chose.
 *
 * Now the amount comes from the server-side price catalogue, checkout happens on
 * Paystack's hosted page, and the record is only marked complete by the webhook
 * after the transaction is re-verified against the provider. This screen never
 * asserts that a payment succeeded; it reads the settled status back.
 */
export function PaymentPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [engagements, setEngagements] = useState<CaseEngagement[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [processing, setProcessing] = useState(false);

  // Set when the user comes back from Paystack.
  const [returning, setReturning] = useState(false);
  const [settled, setSettled] = useState<Payment | null>(null);
  const [settlementTimedOut, setSettlementTimedOut] = useState(false);

  const returnedReference = searchParams.get('reference') ?? searchParams.get('trxref');
  const prefilledPurpose = searchParams.get('purpose');
  const caseId = searchParams.get('caseId') ?? undefined;
  const propertyId = searchParams.get('propertyId') ?? undefined;

  const loadEngagements = useCallback(async () => {
    if (!caseId) return;
    const { engagements: rows } = await fetchCaseEngagements(caseId);
    setEngagements(rows);
  }, [caseId]);

  useEffect(() => {
    void loadEngagements();
  }, [loadEngagements]);

  const loadPrices = useCallback(async () => {
    const { prices: list, error } = await fetchServicePrices();
    if (error) toast.error(error);
    setPrices(list);
    setLoadingPrices(false);
  }, []);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  useEffect(() => {
    if (prefilledPurpose) setSelectedKey(prefilledPurpose);
  }, [prefilledPurpose]);

  /** Wait for the webhook to settle the payment the user just completed. */
  const confirmReturn = useCallback(async (reference: string) => {
    setReturning(true);
    const { payment } = await getPaymentByReference(reference);

    if (!payment) {
      setSettlementTimedOut(true);
      setReturning(false);
      return;
    }

    if (payment.status !== 'pending') {
      setSettled(payment);
      setReturning(false);
      return;
    }

    const { payment: final, settled: didSettle } = await awaitPaymentSettlement(payment.id);
    setSettled(final ?? payment);
    setSettlementTimedOut(!didSettle);
    setReturning(false);
  }, []);

  useEffect(() => {
    if (returnedReference) void confirmReturn(returnedReference);
  }, [returnedReference, confirmReturn]);

  const selected = useMemo(
    () => prices.find((p) => p.key === selectedKey) ?? null,
    [prices, selectedKey]
  );

  /**
   * The engagement this service is being paid against, if any.
   *
   * The three professional services are not sold off the catalogue: an
   * administrator books one and the complainant owes the DEPOSIT, which is
   * typically half. Pricing them from `service_prices` here showed the full
   * total on a screen the engagement panel had just labelled with the deposit.
   * payments-initialize is the authority and now prices these from the
   * engagement; this keeps the quoted figure honest before the redirect.
   */
  const selectedEngagement = openEngagementFor(engagements, selected?.key);

  const total = selected ? amountDue(selected, selectedEngagement, quantity) : 0;

  const grouped = useMemo(() => {
    const out = new Map<PriceModule, ServicePrice[]>();
    // Only what this person may actually buy: platform services, plus any
    // professional service an administrator has booked against this case.
    for (const price of purchasableServices(prices, engagements)) {
      const list = out.get(price.module) ?? [];
      list.push(price);
      out.set(price.module, list);
    }
    return out;
  }, [prices, engagements]);

  const handleCheckout = async () => {
    if (!selected || !user) return;
    setProcessing(true);

    const { data, error } = await startPayment({
      purpose: selected.key,
      quantity,
      caseId,
      propertyId,
      callbackPath: '/app/payments',
    });

    if (error || !data) {
      toast.error(error ?? 'Could not start the payment.');
      setProcessing(false);
      return;
    }

    // Hosted checkout, not the inline popup: the result is confirmed by webhook
    // rather than by a callback in this tab that we would have to trust.
    // Refuse to send a payer anywhere that is not a Paystack checkout host.
    // See lib/paymentRedirect.ts — this is the last hop before card details.
    if (!goToCheckout(data.authorizationUrl)) {
      toast.error('The payment provider returned an address we do not trust. Nothing has been charged.');
      setProcessing(false);
      return;
    }
  };

  // ── Returning from Paystack ────────────────────────────────────────────────
  if (returning) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <Spinner size="lg" />
        <h1 className="text-lg font-semibold text-surface-900">Confirming your payment</h1>
        <p className="text-sm text-surface-500">
          We are waiting for the payment provider to confirm the transaction. This usually takes a
          few seconds — please do not close this page.
        </p>
      </div>
    );
  }

  if (settled) {
    const isComplete = settled.status === 'completed';
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto mt-16 text-center space-y-6"
      >
        <div className="flex justify-center">
          {isComplete ? (
            <CheckCircle2 size={72} className="text-brand-500" />
          ) : (
            <AlertTriangle size={72} className="text-amber-500" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-surface-900">
          {isComplete ? 'Payment confirmed' : 'Payment not completed'}
        </h1>

        <p className="text-surface-600">
          {isComplete ? (
            <>
              We received <strong>{formatCurrency(Number(settled.amount), settled.currency)}</strong>{' '}
              for {settled.description}. A receipt is on its way to{' '}
              <strong>{user?.email}</strong>.
            </>
          ) : (
            <>
              This transaction has not been confirmed by the provider. You have not been charged for
              an incomplete payment — if your bank shows a debit, contact support with the reference
              below and we will reconcile it.
            </>
          )}
        </p>

        {settled.provider_reference && (
          <p className="text-xs text-surface-400 font-mono break-all">
            Ref: {settled.provider_reference}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setSettled(null);
              setSettlementTimedOut(false);
              setSelectedKey('');
              setQuantity(1);
              navigate('/app/payments', { replace: true });
            }}
          >
            Make another payment
          </Button>
          <Button onClick={() => navigate('/app/payments/history')} icon={ArrowRight}>
            View history
          </Button>
        </div>
      </motion.div>
    );
  }

  if (settlementTimedOut && returnedReference) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <EmptyState
          icon={AlertTriangle}
          title="Still confirming"
          description="The provider has not confirmed this transaction yet. It will appear in your payment history as soon as it settles — you do not need to pay again."
          action={
            <Button onClick={() => navigate('/app/payments/history')}>Go to payment history</Button>
          }
        />
      </div>
    );
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-surface-900 mb-2">Make a payment</h1>
      <p className="text-surface-500 mb-6">
        Choose a service below. Prices are set by The Security Watch and shown in full before you
        pay — there are no additional fees at checkout.
      </p>

      {loadingPrices ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : prices.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No services available"
          description="There is nothing available to purchase right now. Please check back shortly."
        />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[...grouped.entries()].map(([module, items]) => (
              <Card key={module}>
                <CardHeader>
                  <h2 className="font-semibold text-surface-900">
                    {PRICE_MODULE_LABELS[module] ?? module}
                  </h2>
                </CardHeader>
                <CardContent className="space-y-2">
                  {items.map((price) => {
                    const isSelected = selectedKey === price.key;
                    return (
                      <button
                        key={price.key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(price.key);
                          setQuantity(1);
                        }}
                        aria-pressed={isSelected}
                        className={cn(
                          'w-full text-left rounded-lg border p-4 transition-colors',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                          isSelected
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-surface-200 hover:border-surface-300 bg-white'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium text-surface-900">{price.label}</p>
                            {price.description && (
                              <p className="text-sm text-surface-500 mt-0.5">{price.description}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-surface-900 tabular-nums">
                              {formatCurrency(Number(price.amount), price.currency)}
                            </p>
                            {price.unit && (
                              <p className="text-xs text-surface-400">{price.unit}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

            <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-50 border border-brand-200">
              <ShieldCheck size={20} className="text-brand-600 mt-0.5 shrink-0" />
              <div className="text-sm text-brand-800">
                <p className="font-medium mb-0.5">Verified by the payment provider</p>
                <p>
                  You complete payment on Paystack's secure checkout. We never see or store your
                  card details, and a payment is only recorded once Paystack confirms it directly to
                  our servers.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-4">
              <CardHeader>
                <h2 className="font-semibold text-surface-900">Summary</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected ? (
                  <>
                    <div>
                      <p className="text-sm text-surface-500">Service</p>
                      <p className="text-sm font-medium text-surface-800">{selected.label}</p>
                    </div>

                    {selected.unit && !selectedEngagement && (
                      <div>
                        <label
                          htmlFor="payment-quantity"
                          className="block text-sm text-surface-500 mb-1.5"
                        >
                          Quantity ({selected.unit})
                        </label>
                        <input
                          id="payment-quantity"
                          type="number"
                          min={1}
                          max={20}
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(Math.min(Math.max(Number(e.target.value) || 1, 1), 20))
                          }
                          className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm bg-white text-surface-900 tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        />
                      </div>
                    )}

                    {selectedEngagement && (
                      <p className="text-xs text-surface-500">
                        Mobilisation deposit —{' '}
                        {Math.round(Number(selectedEngagement.deposit_rate) * 100)}% of the agreed{' '}
                        {formatCurrency(
                          Number(selectedEngagement.total_amount),
                          selectedEngagement.currency
                        )}
                        . The balance is due as the work proceeds.
                      </p>
                    )}

                    <div className="pt-2 border-t border-surface-200">
                      <p className="text-sm text-surface-500">
                        {selectedEngagement ? 'Deposit due now' : 'Total'}
                      </p>
                      <p className="text-2xl font-bold text-surface-900 tabular-nums">
                        {formatCurrency(total, selected.currency)}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-surface-500">
                    Select a service to see the total.
                  </p>
                )}

                <div>
                  <p className="text-sm text-surface-500">Paying as</p>
                  <p className="text-sm font-medium text-surface-700 truncate">{user?.email}</p>
                </div>

                <Button
                  onClick={handleCheckout}
                  disabled={!selected || processing}
                  loading={processing}
                  className="w-full"
                  size="lg"
                  icon={Lock}
                >
                  {processing
                    ? 'Opening checkout…'
                    : selected
                      ? `Pay ${formatCurrency(total, selected.currency)}`
                      : 'Choose a service'}
                </Button>

                <p className="text-xs text-surface-400 text-center">
                  You will be taken to Paystack to complete payment.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default PaymentPage;

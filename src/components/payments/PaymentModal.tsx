import { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck, Lock } from 'lucide-react';
import { Modal, Button, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { startPayment, fetchServicePrices, formatCurrency } from '@/services/paymentService';
import type { ServicePrice } from '@/types';
import toast from 'react-hot-toast';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** A key from the service_prices catalogue. The amount is priced server-side. */
  purpose: string;
  caseId?: string;
  propertyId?: string;
  quantity?: number;
  /** Where Paystack returns the user. Defaults to the payments screen. */
  callbackPath?: string;
  /** Shown above the price when the caller has extra context to give. */
  note?: string;
}

/**
 * Confirms and starts a checkout.
 *
 * The modal used to take an `amount` prop from the calling component, open the
 * Paystack inline popup, and write a `completed` payment row from its callback.
 * It now names a purpose and lets the server price it; the payment is settled by
 * the webhook, so nothing here can assert a payment that did not happen.
 */
export function PaymentModal({
  isOpen,
  onClose,
  purpose,
  caseId,
  propertyId,
  quantity = 1,
  callbackPath,
  note,
}: PaymentModalProps) {
  const user = useAuthStore((s) => s.user);
  const [price, setPrice] = useState<ServicePrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { prices, error } = await fetchServicePrices();
      if (cancelled) return;
      if (error) toast.error(error);
      setPrice(prices.find((p) => p.key === purpose) ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, purpose]);

  const total = price ? Number(price.amount) * quantity : 0;

  const handleConfirm = async () => {
    if (!user) {
      toast.error('Sign in to make a payment.');
      return;
    }
    if (!price) return;

    setProcessing(true);
    const { data, error } = await startPayment({
      purpose,
      quantity,
      caseId,
      propertyId,
      callbackPath,
    });

    if (error || !data) {
      toast.error(error ?? 'Could not start the payment.');
      setProcessing(false);
      return;
    }

    window.location.href = data.authorizationUrl;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm payment" size="md">
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : !price ? (
          <p className="text-sm text-surface-600">
            This service is not available for purchase right now. Please contact support.
          </p>
        ) : (
          <>
            {note && <p className="text-sm text-surface-600">{note}</p>}

            <div>
              <p className="text-sm text-surface-500">{price.label}</p>
              <p className="text-2xl font-bold text-surface-900 tabular-nums">
                {formatCurrency(total, price.currency)}
              </p>
              {quantity > 1 && price.unit && (
                <p className="text-xs text-surface-400 mt-0.5">
                  {quantity} × {formatCurrency(Number(price.amount), price.currency)} {price.unit}
                </p>
              )}
            </div>

            {price.description && (
              <div>
                <p className="text-sm text-surface-500">What this covers</p>
                <p className="text-surface-700 text-sm">{price.description}</p>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-50 border border-brand-200">
              <ShieldCheck size={18} className="text-brand-600 mt-0.5 shrink-0" />
              <p className="text-xs text-brand-800">
                You will complete payment on Paystack's secure checkout. Your card details never
                reach our servers, and the payment is confirmed to us directly by the provider.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={processing}
            disabled={processing || loading || !price}
            className="flex-1"
            icon={price ? Lock : CreditCard}
          >
            {processing
              ? 'Opening checkout…'
              : price
                ? `Pay ${formatCurrency(total, price.currency)}`
                : 'Unavailable'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

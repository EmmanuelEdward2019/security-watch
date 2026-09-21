import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Badge, Button, Card, CardContent, EmptyState, Spinner } from '@/components/ui';
import { fetchCasePayments, fetchServicePrices, formatCurrency } from '@/services/paymentService';
import { filingFeeKeyFor } from '@/lib/filingFee';
import type { CaseUrgency, Payment, PaymentStatus, ServicePrice } from '@/types';

/**
 * The money side of a single case.
 *
 * What was here before: a "Make Payment" button with no onClick, above a
 * hardcoded "No payments yet" that never queried anything. So the case page
 * showed no payments whether or not any existed, and the button did nothing —
 * on the very screen CreateCasePage points at when someone chooses "Pay
 * later", with the words "You can pay later from the case page."
 *
 * RLS on `payments` is `payer_id = auth.uid() OR is_admin()`, so an assigned
 * investigator gets an empty list here. That is correct — what the complainant
 * paid is not their business — but an empty state would read as "this case has
 * no payments", which is a different and false claim. So the whole panel
 * renders nothing for viewers who cannot see the rows.
 */

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
};

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  pending: 'warning',
  completed: 'success',
  failed: 'danger',
  refunded: 'default',
};

export interface CasePaymentsPanelProps {
  caseId: string;
  urgency: CaseUrgency;
  /** False for cases filed before the fee existed (032). */
  filingFeeRequired: boolean;
  filingFeePaidAt?: string | null;
  /** True when the viewer is the complainant, who is the one asked to pay. */
  isComplainant: boolean;
  /** Administrators see the rows too, but are never shown a pay button. */
  isAdmin: boolean;
}

export function CasePaymentsPanel({
  caseId,
  urgency,
  filingFeeRequired,
  filingFeePaidAt,
  isComplainant,
  isAdmin,
}: CasePaymentsPanelProps) {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filingPrice, setFilingPrice] = useState<ServicePrice | null>(null);
  const [loading, setLoading] = useState(true);

  // Shared with CreateCasePage so the two screens cannot quote different
  // fees for the same case. See lib/filingFee.
  const filingKey = filingFeeKeyFor(urgency);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ payments: rows }, { prices }] = await Promise.all([
      fetchCasePayments(caseId),
      fetchServicePrices(),
    ]);
    setPayments(rows);
    setFilingPrice(prices.find((p) => p.key === filingKey) ?? null);
    setLoading(false);
  }, [caseId, filingKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isComplainant && !isAdmin) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const feeOutstanding = filingFeeRequired && !filingFeePaidAt;

  return (
    <div className="space-y-6">
      {feeOutstanding && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={20} />
                <div>
                  <p className="font-medium text-surface-900">Filing fee outstanding</p>
                  <p className="mt-1 text-sm text-surface-600">
                    {filingPrice
                      ? `${formatCurrency(Number(filingPrice.amount), filingPrice.currency)} is due on this case.`
                      : 'A filing fee is due on this case.'}{' '}
                    The case stays open and everything on it is preserved, but it cannot be
                    assigned to a professional until the fee is paid.
                  </p>
                </div>
              </div>

              {isComplainant && (
                <Button
                  icon={CreditCard}
                  className="shrink-0"
                  onClick={() =>
                    navigate(
                      `/app/payments?purpose=${filingKey}&caseId=${encodeURIComponent(caseId)}`
                    )
                  }
                >
                  {filingPrice
                    ? `Pay ${formatCurrency(Number(filingPrice.amount), filingPrice.currency)}`
                    : 'Pay filing fee'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {filingFeeRequired && filingFeePaidAt && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 size={15} />
          Filing fee paid on {format(new Date(filingFeePaidAt), 'd MMM yyyy')}.
        </p>
      )}

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Payments made against this case will appear here."
        />
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-surface-900">
                    {p.description || p.purpose}
                  </p>
                  <p className="mt-0.5 text-xs text-surface-500">
                    {format(new Date(p.created_at), 'd MMM yyyy, HH:mm')}
                    {p.provider_reference && (
                      <span className="ml-2 font-mono">{p.provider_reference}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium tabular-nums text-surface-900">
                    {formatCurrency(Number(p.amount), p.currency)}
                  </span>
                  <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

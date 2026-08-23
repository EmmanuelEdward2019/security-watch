import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, CreditCard, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, Spinner } from '@/components/ui';
import { fetchCaseEngagements, type CaseEngagement } from '@/services/engagementService';

/**
 * The money side of a case, for the people it concerns.
 *
 * The gap this closes: booking an engagement notified the complainant that "a
 * deposit is needed to begin work" and linked them to the case — where nothing
 * mentioned an engagement, showed an amount, or offered a way to pay. The flow
 * dead-ended on a screen that knew nothing about it.
 *
 * Visible to the complainant (their obligation), the booked professional (what
 * they will be paid) and administrators. RLS enforces that; this component only
 * decides what to say to each.
 */

const STATUS_VARIANT: Record<CaseEngagement['status'], 'success' | 'warning' | 'danger' | 'default'> = {
  awaiting_deposit: 'warning',
  funded: 'success',
  in_progress: 'success',
  completed: 'default',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<CaseEngagement['status'], string> = {
  awaiting_deposit: 'Deposit needed',
  funded: 'Funded',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ROLE_LABEL: Record<CaseEngagement['professional_role'], string> = {
  investigator: 'Investigator',
  lawyer: 'Lawyer',
  medical_expert: 'Medical expert',
};

export interface EngagementPanelProps {
  caseId: string;
  /** True when the viewer is the complainant, who is the one asked to pay. */
  isComplainant: boolean;
}

export function EngagementPanel({ caseId, isComplainant }: EngagementPanelProps) {
  const navigate = useNavigate();
  const [engagements, setEngagements] = useState<CaseEngagement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { engagements: rows } = await fetchCaseEngagements(caseId);
    setEngagements(rows);
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Nothing booked is the normal state for most cases. An empty card explaining
  // that would be noise on every case that never needs a professional.
  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  const live = engagements.filter((e) => e.status !== 'cancelled');
  if (live.length === 0) return null;

  const money = (v: number, currency: string) =>
    `${currency} ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 font-semibold text-surface-900">
          <Briefcase size={18} className="text-brand-500" />
          Professionals engaged
        </h2>
      </CardHeader>

      <CardContent className="space-y-3">
        {live.map((e) => (
          <div key={e.id} className="rounded-lg border border-surface-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-surface-900">
                  {e.professional?.full_name ?? 'Assigned professional'}
                </p>
                <p className="text-sm text-surface-500">{ROLE_LABEL[e.professional_role]}</p>
              </div>
              <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABEL[e.status]}</Badge>
            </div>

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-surface-500">Total fee</dt>
                <dd className="tabular-nums text-surface-700">
                  {money(e.total_amount, e.currency)}
                </dd>
              </div>

              {/*
                The complainant is told the deposit; the professional is told
                their share. Showing each the other's figure would be showing
                them a number that is not theirs — the commission is not the
                complainant's business, and the total is not what the
                professional receives.
              */}
              {isComplainant ? (
                <div className="flex justify-between">
                  <dt className="text-surface-500">
                    Deposit to begin ({Math.round(Number(e.deposit_rate) * 100)}%)
                  </dt>
                  <dd className="font-medium tabular-nums text-surface-900">
                    {money(e.deposit_amount, e.currency)}
                  </dd>
                </div>
              ) : (
                <div className="flex justify-between">
                  <dt className="text-surface-500">Your share</dt>
                  <dd className="font-medium tabular-nums text-surface-900">
                    {money(e.professional_amount, e.currency)}
                  </dd>
                </div>
              )}
            </dl>

            {e.status === 'awaiting_deposit' && isComplainant && (
              <div className="mt-4">
                <Button
                  size="sm"
                  icon={CreditCard}
                  onClick={() =>
                    navigate(
                      `/app/payments?purpose=${encodeURIComponent(e.service_key)}&caseId=${encodeURIComponent(caseId)}`
                    )
                  }
                >
                  Pay {money(e.deposit_amount, e.currency)} deposit
                </Button>
                <p className="mt-2 text-xs text-surface-500">
                  Held by The Security Watch and released to your{' '}
                  {ROLE_LABEL[e.professional_role].toLowerCase()} as the work proceeds.
                </p>
              </div>
            )}

            {e.status !== 'awaiting_deposit' && e.deposit_paid_at && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 size={13} />
                Deposit received — work can proceed.
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

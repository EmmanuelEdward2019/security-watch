import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { DollarSign, Clock, CheckCircle, TrendingUp, Download, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatsCard, Card, CardHeader, CardContent, Button, Badge, Spinner, EmptyState } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { fetchMyEarnings } from '@/services/propertyExtrasService';
import type { EarningRecord, PayoutStatus } from '@/types';

/**
 * What The Security Watch owes this professional.
 *
 * This screen used to query `payments` for every case the user was assigned to
 * and present those figures as their earnings. That was the complainant's money
 * — the full catalogue price, gross of commission, and not owed to the
 * professional at all. An investigator on a ₦150,000 retainer saw "₦150,000
 * earned" when their actual share was ₦120,000, none of which had been
 * released.
 *
 * It now reads the payout ledger, so every figure is a real obligation: the
 * professional's share after commission, at a known status, with the transfer
 * reference once it has been paid.
 */

const STATUS_VARIANT: Record<PayoutStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  released: 'success',
  approved: 'warning',
  accrued: 'default',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<PayoutStatus, string> = {
  released: 'Paid out',
  approved: 'Approved',
  accrued: 'Owed',
  cancelled: 'Cancelled',
};

const REASON_LABEL: Record<EarningRecord['reason'], string> = {
  deposit_share: 'Mobilisation deposit',
  balance_share: 'Balance on completion',
  adjustment: 'Adjustment',
};

export default function EarningsPage() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { earnings } = await fetchMyEarnings();
    setEntries(earnings);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = entries.filter((e) => e.status !== 'cancelled');

  const paidOut = live
    .filter((e) => e.status === 'released')
    .reduce((sum, e) => sum + e.amount, 0);

  // Accrued and approved are both money owed but not yet sent. Approved simply
  // means an administrator has signed it off for transfer.
  const owed = live
    .filter((e) => e.status === 'accrued' || e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  const releasedCount = live.filter((e) => e.status === 'released').length;
  const currency = entries[0]?.currency ?? 'NGN';

  const handleExport = () => {
    const rows = [
      ['Date', 'Case', 'Tranche', 'Amount', 'Currency', 'Status', 'Reference', 'Paid on'],
      ...entries.map((e) => [
        format(new Date(e.created_at), 'yyyy-MM-dd'),
        e.case_title,
        REASON_LABEL[e.reason],
        e.amount.toString(),
        e.currency,
        STATUS_LABEL[e.status],
        e.reference ?? '',
        e.released_at ? format(new Date(e.released_at), 'yyyy-MM-dd') : '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Earnings</h1>
          <p className="mt-1 text-surface-500">
            Your share of each engagement, after The Security Watch&apos;s commission.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/app/payout-account">
            <Button variant="outline" size="sm" icon={Landmark}>
              Payout account
            </Button>
          </Link>
          {entries.length > 0 && (
            <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard
              icon={DollarSign}
              label="Paid out"
              value={`${currency} ${paidOut.toLocaleString()}`}
              variant="success"
            />
            <StatsCard
              icon={Clock}
              label="Owed to you"
              value={`${currency} ${owed.toLocaleString()}`}
              variant="warning"
            />
            <StatsCard
              icon={CheckCircle}
              label="Payouts received"
              value={releasedCount}
              variant="teal"
            />
          </div>

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 font-semibold text-surface-900">
                <TrendingUp size={18} className="text-brand-500" />
                Payout history
              </h2>
            </CardHeader>
            <CardContent className="p-0">
              {entries.length === 0 ? (
                <EmptyState
                  icon={DollarSign}
                  tint="teal"
                  title="Nothing owed yet"
                  description="Once a complainant funds an engagement you have been booked on, your share appears here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100 text-left">
                        <th className="px-6 py-3 font-medium text-surface-500">Date</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Case</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Tranche</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Your share</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Reference</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.ledger_id} className="border-b border-surface-50 last:border-0">
                          <td className="whitespace-nowrap px-6 py-3 text-surface-600">
                            {format(new Date(e.created_at), 'd MMM yyyy')}
                          </td>
                          <td className="px-6 py-3 text-surface-900">{e.case_title}</td>
                          <td className="px-6 py-3 text-surface-600">{REASON_LABEL[e.reason]}</td>
                          <td className="whitespace-nowrap px-6 py-3 font-medium tabular-nums text-surface-900">
                            {e.currency} {e.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 font-mono text-xs text-surface-500">
                            {e.reference ?? '—'}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={STATUS_VARIANT[e.status]}>
                              {STATUS_LABEL[e.status]}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}

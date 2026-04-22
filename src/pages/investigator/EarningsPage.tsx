import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Clock, CheckCircle, Download, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { StatsCard, Card, CardHeader, CardContent, Button, Badge, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import type { Payment, PaymentStatus } from '@/types';

const STATUS_VARIANT: Record<PaymentStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'default',
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  completed: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
};

export default function EarningsPage() {
  const user = useAuthStore((s) => s.user);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadEarnings() {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch cases assigned to this investigator (or lawyer)
      const caseQuery =
        user.role === 'lawyer'
          ? supabase.from('cases').select('id').eq('assigned_lawyer_id', user.user_id)
          : supabase.from('cases').select('id').eq('assigned_investigator_id', user.user_id);

      const { data: assignedCases } = await caseQuery;
      const caseIds = (assignedCases ?? []).map((c) => c.id);

      if (caseIds.length === 0) {
        setPayments([]);
        setLoading(false);
        return;
      }

      // Payments made for those cases represent this user's earnings
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .in('case_id', caseIds)
        .order('created_at', { ascending: false });

      if (!error && data) setPayments(data as Payment[]);
    } finally {
      setLoading(false);
    }
  }

  const totalEarned = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingPayout = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  const completedCount = payments.filter((p) => p.status === 'completed').length;

  const handleExport = () => {
    const rows = [
      ['Date', 'Description', 'Amount', 'Currency', 'Reference', 'Status'],
      ...payments.map((p) => [
        format(new Date(p.created_at), 'yyyy-MM-dd'),
        p.description,
        p.amount.toString(),
        p.currency,
        p.provider_reference ?? '',
        p.status,
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

  const currency = payments[0]?.currency ?? 'NGN';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Earnings</h1>
          <p className="text-surface-500 mt-1">
            Track income from your assigned cases.
          </p>
        </div>
        {payments.length > 0 && (
          <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              icon={DollarSign}
              label="Total Earned"
              value={`${currency} ${totalEarned.toLocaleString()}`}
              variant="success"
            />
            <StatsCard
              icon={Clock}
              label="Pending Payout"
              value={`${currency} ${pendingPayout.toLocaleString()}`}
              variant="warning"
            />
            <StatsCard
              icon={CheckCircle}
              label="Payments Received"
              value={completedCount}
              variant="brand"
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="font-semibold text-surface-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-500" />
                Payment History
              </h2>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="py-16 text-center text-surface-500">
                  <DollarSign size={40} className="mx-auto mb-3 text-surface-300" />
                  <p className="font-medium">No earnings yet</p>
                  <p className="text-sm mt-1">
                    Earnings will appear here once clients make payments for your assigned cases.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100 text-left">
                        <th className="px-6 py-3 font-medium text-surface-500">Date</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Description</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Amount</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Reference</th>
                        <th className="px-6 py-3 font-medium text-surface-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-surface-50 transition-colors">
                          <td className="px-6 py-3 text-surface-600 whitespace-nowrap">
                            {format(new Date(p.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-3 text-surface-900 font-medium max-w-xs truncate">
                            {p.description}
                          </td>
                          <td className="px-6 py-3 text-surface-900 font-semibold whitespace-nowrap">
                            {p.currency} {p.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-surface-500 font-mono text-xs truncate max-w-[120px]">
                            {p.provider_reference ?? '—'}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant={STATUS_VARIANT[p.status]} size="sm" dot>
                              {STATUS_LABEL[p.status]}
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

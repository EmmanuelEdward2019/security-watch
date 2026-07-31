import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Clock, CheckCircle2, Home, Receipt } from 'lucide-react';
import {
  StatsCard,
  Card,
  CardHeader,
  CardContent,
  DataTable,
  StatusBadge,
  EmptyState,
  Spinner,
  Select,
} from '@/components/ui';
import type { Column } from '@/components/ui/DataTable';
import { fetchLandlordTransactions } from '@/services/propertyExtrasService';
import { formatCurrency } from '@/services/paymentService';
import type { LandlordTransaction } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

/**
 * Landlord payment ledger.
 *
 * Was a hardcoded array of invented transactions. Now derived from real
 * `payments` rows joined to the landlord's own properties, through an RPC that
 * scopes the join to the caller — and every row shown has been verified by the
 * Paystack webhook rather than self-reported by a browser.
 */
export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<LandlordTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { transactions: rows, error } = await fetchLandlordTransactions();
    if (error) toast.error(error);
    setTransactions(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'completed');
    const pending = transactions.filter((t) => t.status === 'pending');
    const currency = transactions[0]?.currency ?? 'NGN';
    return {
      received: completed.reduce((sum, t) => sum + t.amount, 0),
      pendingCount: pending.length,
      completedCount: completed.length,
      currency,
    };
  }, [transactions]);

  const visible = useMemo(
    () => (statusFilter ? transactions.filter((t) => t.status === statusFilter) : transactions),
    [transactions, statusFilter]
  );

  const columns: Column<LandlordTransaction>[] = [
    {
      id: 'property',
      header: 'Property',
      accessor: 'property_title',
      render: (value) => (
        <span className="font-medium text-surface-900 line-clamp-1">{value as string}</span>
      ),
    },
    {
      id: 'from',
      header: 'From',
      accessor: (row) => row.counterparty_name ?? '—',
      render: (value) => <span className="text-sm text-surface-700">{value as string}</span>,
    },
    {
      id: 'purpose',
      header: 'For',
      accessor: (row) => row.purpose?.replace(/_/g, ' ') ?? '—',
      render: (value) => (
        <span className="text-sm text-surface-600 capitalize">{value as string}</span>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      accessor: 'amount',
      render: (_value, row) => (
        <span className="font-semibold text-surface-900 tabular-nums">
          {formatCurrency(row.amount, row.currency)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      render: (value) => {
        const status = value as LandlordTransaction['status'];
        return (
          <StatusBadge
            status={
              status === 'completed'
                ? 'completed'
                : status === 'failed'
                  ? 'rejected'
                  : status === 'refunded'
                    ? 'cancelled'
                    : 'pending'
            }
          />
        );
      },
    },
    {
      id: 'reference',
      header: 'Reference',
      accessor: (row) => row.reference ?? '—',
      render: (value) => (
        <span className="text-xs font-mono text-surface-400">
          {(value as string).slice(0, 18)}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessor: 'created_at',
      render: (value) => (
        <span className="text-sm text-surface-500 whitespace-nowrap">
          {format(new Date(value as string), 'd MMM yyyy')}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Transactions</h1>
        <p className="text-surface-500 mt-1">
          Payments received against your listings. Every amount here has been confirmed by the
          payment provider.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          label="Total received"
          value={formatCurrency(stats.received, stats.currency)}
          icon={Wallet}
          variant="success"
        />
        <StatsCard label="Settled payments" value={stats.completedCount} icon={CheckCircle2} />
        <StatsCard label="Awaiting settlement" value={stats.pendingCount} icon={Clock} variant="warning" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <Receipt size={16} /> Ledger
            </h2>
            <div className="w-full sm:w-52">
              <Select
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'failed', label: 'Failed' },
                  { value: 'refunded', label: 'Refunded' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <EmptyState
              icon={Home}
              title={transactions.length === 0 ? 'No transactions yet' : 'Nothing matches that filter'}
              description={
                transactions.length === 0
                  ? 'Payments made against your listings — verification fees, featured placements, tenant checks — will appear here once they settle.'
                  : 'Try a different status.'
              }
            />
          ) : (
            <DataTable columns={columns} data={visible} pageSize={15} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

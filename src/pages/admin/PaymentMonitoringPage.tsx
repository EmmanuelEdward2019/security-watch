import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, DollarSign } from 'lucide-react';
import {
  DataTable,
  type Column,
  Badge,
  Select,
  StatsCard,
  Card,
  CardHeader,
  CardContent,
} from '@/components/ui';
import { usePaymentStore } from '@/stores/paymentStore';
import type { Payment, PaymentProvider, PaymentStatus } from '@/types';
import { format } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

const PROVIDER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paystack', label: 'Paystack' },
];

function getStatusVariant(s: PaymentStatus) {
  return s === 'completed' ? 'success' : s === 'failed' ? 'danger' : s === 'pending' ? 'warning' : 'default';
}

export function PaymentMonitoringPage() {
  const { payments, fetchPayments, filters, setFilters } = usePaymentStore();
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchPayments();
    setLoading(false);
  }, [fetchPayments, filters]);

  const filtered = payments.filter((p) => {
    if (dateFrom && new Date(p.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(p.created_at) > new Date(dateTo)) return false;
    return true;
  });

  const totalRevenue = filtered.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const pending = filtered.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const completed = filtered.filter((p) => p.status === 'completed').length;
  const failed = filtered.filter((p) => p.status === 'failed').length;

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });
  const revenueByMonth = months.map((m) => ({
    month: format(m, 'MMM'),
    amount: filtered
      .filter((p) => p.status === 'completed')
      .filter((p) => {
        const d = new Date(p.created_at);
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      })
      .reduce((s, p) => s + p.amount, 0),
  }));

  const columns: Column<Payment>[] = [
    {
      id: 'description',
      header: 'Description',
      accessor: 'description',
      render: (v) => <span className="font-medium">{String(v)}</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      accessor: (row) => `${row.currency} ${row.amount.toLocaleString()}`,
    },
    {
      id: 'provider',
      header: 'Provider',
      accessor: 'provider',
      render: (v) => <Badge variant="info">{String(v)}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      render: (v) => <Badge variant={getStatusVariant(v as PaymentStatus)}>{String(v)}</Badge>,
    },
    {
      id: 'date',
      header: 'Date',
      accessor: 'created_at',
      render: (v) => format(new Date(String(v)), 'MMM d, yyyy HH:mm'),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Payment Monitoring</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={DollarSign} label="Total Revenue" value={totalRevenue.toLocaleString()} variant="success" />
        <StatsCard icon={CreditCard} label="Pending" value={pending.toLocaleString()} variant="warning" />
        <StatsCard icon={CreditCard} label="Completed" value={completed} variant="default" />
        <StatsCard icon={CreditCard} label="Failed" value={failed} variant="accent" />
      </div>

      <div className="flex flex-wrap gap-4">
        <Select
          options={STATUS_OPTIONS}
          value={filters.status ?? ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as PaymentStatus || undefined })}
          className="w-40"
        />
        <Select
          options={PROVIDER_OPTIONS}
          value={filters.provider ?? ''}
          onChange={(e) => setFilters({ ...filters, provider: e.target.value as PaymentProvider || undefined })}
          className="w-40"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-surface-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-surface-300 px-3 py-2 text-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-surface-900">Revenue Over Time</h2>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#166534" fill="#166534" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyMessage="No payments yet"
        />
      </div>
    </motion.div>
  );
}

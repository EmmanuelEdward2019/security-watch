import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePaymentStore } from '@/stores/paymentStore';
import {
  DataTable,
  Badge,
  Select,
  Modal,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import type { Payment, PaymentProvider, PaymentStatus } from '@/types';
import { format } from 'date-fns';

// Add payment status labels if not in types
const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
  refunded: 'Refunded',
};

const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: 'Stripe',
  paystack: 'Paystack',
};

function getStatusVariant(status: PaymentStatus): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'refunded':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'default';
  }
}

export function PaymentHistoryPage() {
  const user = useAuthStore((s) => s.user);
  const { payments, isLoading, fetchPayments, filters, setFilters } = usePaymentStore();
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (user) fetchPayments(user.user_id);
  }, [user, fetchPayments, filters]);

  const columns: Column<Payment>[] = [
    {
      id: 'description',
      header: 'Description',
      accessor: 'description',
      render: (v) => <span className="font-medium">{String(v ?? '')}</span>,
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
      render: (v) => (
        <Badge variant="info" size="sm">
          {PAYMENT_PROVIDER_LABELS[v as PaymentProvider] ?? v}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      render: (v) => (
        <Badge variant={getStatusVariant(v as PaymentStatus)} size="sm">
          {PAYMENT_STATUS_LABELS[v as PaymentStatus] ?? v}
        </Badge>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      accessor: 'created_at',
      render: (v) => format(new Date(String(v)), 'MMM d, yyyy HH:mm'),
    },
    {
      id: 'actions',
      header: '',
      accessor: () => null,
      render: (_, row) => (
        <button
          type="button"
          onClick={() => setSelectedPayment(row)}
          className="p-2 rounded-lg text-surface-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          aria-label="View details"
        >
          <Eye size={18} />
        </button>
      ),
    },
  ];

  const statusOptions = [
    { value: '', label: 'All statuses' },
    ...Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  ];
  const providerOptions = [
    { value: '', label: 'All providers' },
    ...Object.entries(PAYMENT_PROVIDER_LABELS).map(([value, label]) => ({ value, label })),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold text-surface-900">Payment History</h1>

      <div className="flex flex-wrap gap-4">
        <Select
          label="Status"
          options={statusOptions}
          value={filters.status ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilters({ ...filters, status: v ? (v as PaymentStatus) : undefined });
          }}
          className="w-40"
        />
        <Select
          label="Provider"
          options={providerOptions}
          value={filters.provider ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setFilters({ ...filters, provider: v ? (v as PaymentProvider) : undefined });
          }}
          className="w-40"
        />
        <button
          type="button"
          onClick={() => user && fetchPayments(user.user_id)}
          className="self-end text-sm text-brand-600 hover:underline"
        >
          Apply filters
        </button>
      </div>

      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
        <DataTable
          columns={columns}
          data={payments}
          loading={isLoading}
          emptyMessage="No payments yet"
        />
      </div>

      <Modal
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        title="Payment Details"
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-surface-500">Description</p>
              <p className="font-medium">{selectedPayment.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-surface-500">Amount</p>
                <p className="font-semibold">
                  {selectedPayment.currency} {selectedPayment.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-surface-500">Status</p>
                <Badge variant={getStatusVariant(selectedPayment.status)}>
                  {PAYMENT_STATUS_LABELS[selectedPayment.status]}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm text-surface-500">Provider</p>
              <p className="font-medium">{PAYMENT_PROVIDER_LABELS[selectedPayment.provider]}</p>
            </div>
            <div>
              <p className="text-sm text-surface-500">Date</p>
              <p className="font-medium">{format(new Date(selectedPayment.created_at), 'PPpp')}</p>
            </div>
            {selectedPayment.provider_reference && (
              <div>
                <p className="text-sm text-surface-500">Reference</p>
                <p className="font-mono text-sm">{selectedPayment.provider_reference}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
}

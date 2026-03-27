import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import type { PaymentProvider } from '@/types';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

const PROVIDERS: { id: PaymentProvider; name: string }[] = [
  { id: 'stripe', name: 'Stripe' },
  { id: 'paystack', name: 'Paystack' },
];

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  description?: string;
  onSuccess?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  amount,
  currency = 'NGN',
  description = 'Payment',
  onSuccess,
}: PaymentModalProps) {
  const [provider, setProvider] = useState<PaymentProvider>('stripe');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);

  const handleConfirm = async () => {
    setProcessing(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 2000));
    const success = Math.random() > 0.2;
    setProcessing(false);
    setResult(success ? 'success' : 'failure');
    if (success) {
      toast.success('Payment completed!');
      onSuccess?.();
    } else {
      toast.error('Payment failed');
    }
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Quick Payment" size="md">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-surface-500">Amount</p>
          <p className="text-2xl font-bold text-surface-900">
            {currency} {amount.toLocaleString()}
          </p>
        </div>
        {description && (
          <div>
            <p className="text-sm text-surface-500">Description</p>
            <p className="text-surface-700">{description}</p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-surface-700 mb-2">Payment Provider</p>
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={cn(
                  'flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all',
                  provider === p.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-surface-200 hover:border-surface-300'
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {result === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2 py-4 text-green-600"
          >
            <CheckCircle2 size={40} />
            <p className="font-semibold">Payment Successful!</p>
          </motion.div>
        )}
        {result === 'failure' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2 py-4 text-accent-600"
          >
            <XCircle size={40} />
            <p className="font-semibold">Payment Failed</p>
          </motion.div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} className="flex-1">
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleConfirm}
              loading={processing}
              disabled={processing}
              className="flex-1"
            >
              Confirm Payment
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

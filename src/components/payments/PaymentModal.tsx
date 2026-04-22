import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { sendTemplatedEmail } from '@/lib/email';
import toast from 'react-hot-toast';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  currency?: string;
  description?: string;
  caseId?: string;
  propertyId?: string;
  onSuccess?: (reference: string) => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  amount,
  currency = 'NGN',
  description = 'Payment',
  caseId,
  propertyId,
  onSuccess,
}: PaymentModalProps) {
  const user = useAuthStore((s) => s.user);
  const { createPayment } = usePaymentStore();
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConfirm = () => {
    if (!user) {
      toast.error('You must be signed in to make a payment.');
      return;
    }

    if (!window.PaystackPop) {
      toast.error('Payment SDK not loaded. Please refresh the page.');
      return;
    }

    const ref = `tsw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setProcessing(true);

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string,
      email: user.email,
      amount: Math.round(amount * 100), // kobo
      currency,
      ref,
      metadata: {
        custom_fields: [
          { display_name: 'Description', variable_name: 'description', value: description },
          { display_name: 'Case ID', variable_name: 'case_id', value: caseId ?? '' },
          { display_name: 'Property ID', variable_name: 'property_id', value: propertyId ?? '' },
          { display_name: 'User ID', variable_name: 'user_id', value: user.user_id },
        ],
      },

      callback: async (response) => {
        await createPayment({
          payer_id: user.user_id,
          amount,
          currency,
          provider: 'paystack',
          provider_reference: response.reference,
          status: 'completed',
          description,
          case_id: caseId,
          property_id: propertyId,
        });

        setProcessing(false);
        setSuccess(true);
        toast.success('Payment successful!');

        // Confirmation email (non-blocking)
        try {
          await sendTemplatedEmail(user.email, 'payment_received', {
            recipientName: user.full_name,
            amount: `${currency} ${amount.toLocaleString()}`,
            currency,
            reference: response.reference,
            dashboardUrl: `${window.location.origin}/app/payments/history`,
          });
        } catch {
          // ignore
        }

        onSuccess?.(response.reference);
      },

      onClose: () => {
        setProcessing(false);
        toast('Payment cancelled.', { icon: 'ℹ️' });
      },
    });

    handler.openIframe();
  };

  const handleClose = () => {
    setSuccess(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Confirm Payment" size="md">
      <div className="space-y-4">
        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-6 text-brand-600"
          >
            <CheckCircle2 size={56} />
            <p className="font-semibold text-lg">Payment Successful!</p>
            <p className="text-sm text-surface-500 text-center">
              A confirmation email has been sent to {user?.email}
            </p>
          </motion.div>
        ) : (
          <>
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

            <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-50 border border-brand-200">
              <CreditCard size={18} className="text-brand-600 mt-0.5 shrink-0" />
              <p className="text-xs text-brand-800">
                You will be redirected to a secure Paystack popup to complete your payment.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} className="flex-1">
            {success ? 'Close' : 'Cancel'}
          </Button>
          {!success && (
            <Button
              onClick={handleConfirm}
              loading={processing}
              disabled={processing}
              className="flex-1"
            >
              Pay {currency} {amount.toLocaleString()}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

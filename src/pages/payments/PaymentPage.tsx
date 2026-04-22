import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, CreditCard, ArrowRight } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardContent } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { usePaymentStore } from '@/stores/paymentStore';
import { sendTemplatedEmail } from '@/lib/email';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

// Paystack types (loaded via CDN script in index.html)
declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number; // kobo
        currency?: string;
        ref: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string; status: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

const CURRENCIES = [
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

export function PaymentPage() {
  const user = useAuthStore((s) => s.user);
  const { createPayment } = usePaymentStore();

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [description, setDescription] = useState('');
  const [caseRef, setCaseRef] = useState('');
  const [propertyRef, setPropertyRef] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'success' | null>(null);
  const [lastReference, setLastReference] = useState('');

  const amountNum = parseFloat(amount) || 0;
  const isValid = amountNum > 0 && description.trim().length > 0 && !!user;

  const handlePaystack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !user) return;

    if (!window.PaystackPop) {
      toast.error('Payment SDK not loaded. Please refresh the page.');
      return;
    }

    const ref = `tsw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setProcessing(true);

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string,
      email: user.email,
      amount: Math.round(amountNum * 100), // kobo
      currency,
      ref,
      metadata: {
        custom_fields: [
          { display_name: 'Description', variable_name: 'description', value: description },
          { display_name: 'Case Ref', variable_name: 'case_ref', value: caseRef },
          { display_name: 'Property Ref', variable_name: 'property_ref', value: propertyRef },
          { display_name: 'User ID', variable_name: 'user_id', value: user.user_id },
        ],
      },

      callback: async (response) => {
        // Payment was authorised — save record to Supabase
        const { error } = await createPayment({
          payer_id: user.user_id,
          amount: amountNum,
          currency,
          provider: 'paystack',
          provider_reference: response.reference,
          status: 'completed',
          description,
          case_id: caseRef || undefined,
          property_id: propertyRef || undefined,
        });

        setProcessing(false);

        if (error) {
          toast.error('Payment recorded but failed to save details. Contact support.');
        } else {
          setResult('success');
          setLastReference(response.reference);
          toast.success('Payment successful!');

          // Send confirmation email
          try {
            await sendTemplatedEmail(user.email, 'payment_received', {
              recipientName: user.full_name,
              amount: `${currency} ${amountNum.toLocaleString()}`,
              currency,
              reference: response.reference,
              dashboardUrl: `${window.location.origin}/app/payments/history`,
            });
          } catch {
            // Non-blocking — payment was still successful
          }
        }
      },

      onClose: () => {
        setProcessing(false);
        toast('Payment cancelled.', { icon: 'ℹ️' });
      },
    });

    handler.openIframe();
  };

  if (result === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto mt-16 text-center space-y-6"
      >
        <div className="flex justify-center">
          <CheckCircle2 size={72} className="text-brand-500" />
        </div>
        <h1 className="text-2xl font-bold text-surface-900">Payment Successful!</h1>
        <p className="text-surface-600">
          Your payment of <strong>{currency} {amountNum.toLocaleString()}</strong> has been
          processed. A confirmation has been sent to <strong>{user?.email}</strong>.
        </p>
        {lastReference && (
          <p className="text-xs text-surface-400 font-mono">Ref: {lastReference}</p>
        )}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setAmount('');
              setDescription('');
              setCaseRef('');
              setPropertyRef('');
            }}
          >
            Make Another Payment
          </Button>
          <Button
            onClick={() => window.location.href = '/app/payments/history'}
            icon={ArrowRight}
          >
            View History
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-2xl font-bold text-surface-900 mb-2">Make a Payment</h1>
      <p className="text-surface-500 mb-6">
        Payments are processed securely via Paystack. Your card details are never stored on our servers.
      </p>

      <form onSubmit={handlePaystack} className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Payment details */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-surface-900">Payment Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Amount"
                  type="number"
                  min="100"
                  step="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm bg-white text-surface-900"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                label="Description"
                placeholder="What is this payment for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <Input
                label="Case Reference (optional)"
                placeholder="Case ID"
                value={caseRef}
                onChange={(e) => setCaseRef(e.target.value)}
              />
              <Input
                label="Property Reference (optional)"
                placeholder="Property ID"
                value={propertyRef}
                onChange={(e) => setPropertyRef(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Security note */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-50 border border-brand-200">
            <CreditCard size={20} className="text-brand-600 mt-0.5 shrink-0" />
            <div className="text-sm text-brand-800">
              <p className="font-medium mb-0.5">Secure payment via Paystack</p>
              <p>
                You will be redirected to a secure Paystack popup to complete your payment. We
                do not store your card details.
              </p>
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <h2 className="font-semibold text-surface-900">Summary</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-surface-500">Amount</p>
                <p className="text-2xl font-bold text-surface-900">
                  {currency}{' '}
                  {amountNum > 0 ? amountNum.toLocaleString() : '—'}
                </p>
              </div>

              {description && (
                <div>
                  <p className="text-sm text-surface-500">Description</p>
                  <p className="text-sm text-surface-700 line-clamp-2">{description}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-surface-500">Paying as</p>
                <p className="text-sm font-medium text-surface-700 truncate">{user?.email}</p>
              </div>

              <AnimatePresence mode="wait">
                <Button
                  type="submit"
                  disabled={!isValid || processing}
                  loading={processing}
                  className={cn('w-full', !isValid && 'opacity-60 cursor-not-allowed')}
                  size="lg"
                >
                  {processing ? 'Opening payment...' : `Pay ${currency} ${amountNum > 0 ? amountNum.toLocaleString() : ''}`}
                </Button>
              </AnimatePresence>

              <p className="text-xs text-surface-400 text-center">
                Protected by Paystack SSL encryption
              </p>
            </CardContent>
          </Card>
        </div>
      </form>
    </motion.div>
  );
}

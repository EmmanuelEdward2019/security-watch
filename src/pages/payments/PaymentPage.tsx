import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardContent } from '@/components/ui';
import type { PaymentProvider } from '@/types';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

const PROVIDERS: { id: PaymentProvider; name: string; region: string; icon: string }[] = [
  { id: 'stripe', name: 'Stripe', region: 'International', icon: '💳' },
  { id: 'paystack', name: 'Paystack', region: 'Nigeria / West Africa', icon: '🌍' },
];

const CURRENCIES = [
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

function formatCardNumber(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 16);
  return v.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const v = value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 2) return `${v.slice(0, 2)}/${v.slice(2)}`;
  return v;
}

export function PaymentPage() {
  const [provider, setProvider] = useState<PaymentProvider>('stripe');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [description, setDescription] = useState('');
  const [caseRef, setCaseRef] = useState('');
  const [propertyRef, setPropertyRef] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setProcessing(true);
    setResult(null);
    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 2500));
    const success = Math.random() > 0.2; // 80% success for demo
    setProcessing(false);
    setResult(success ? 'success' : 'failure');
    if (success) toast.success('Payment completed!');
    else toast.error('Payment failed. Please try again.');
  };

  const amountNum = parseFloat(amount) || 0;
  const isValid = amountNum > 0 && description.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <h1 className="text-2xl font-bold text-surface-900 mb-6">Make a Payment</h1>

      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Provider selection */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-surface-900">Payment Provider</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {PROVIDERS.map((p) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all',
                      provider === p.id
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-surface-200 hover:border-brand-300'
                    )}
                  >
                    <span className="text-3xl">{p.icon}</span>
                    <span className="font-semibold text-surface-900">{p.name}</span>
                    <span className="text-sm text-surface-500">{p.region}</span>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>

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
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
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
                placeholder="Payment for..."
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

              {provider === 'stripe' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 pt-4 border-t border-surface-200"
                >
                  <h3 className="font-medium text-surface-700">Card Details</h3>
                  <Input
                    label="Card Number"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Expiry"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                    />
                    <Input
                      label="CVV"
                      type="password"
                      placeholder="123"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                    />
                  </div>
                </motion.div>
              )}

              {provider === 'paystack' && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-surface-500"
                >
                  You will be redirected to Paystack to complete your payment securely.
                </motion.p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <h2 className="font-semibold text-surface-900">Order Summary</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-surface-500">Amount</p>
                <p className="text-2xl font-bold text-surface-900">
                  {currency} {amountNum.toLocaleString()}
                </p>
              </div>
              {description && (
                <div>
                  <p className="text-sm text-surface-500">Description</p>
                  <p className="text-sm text-surface-700">{description}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-surface-500">Provider</p>
                <p className="text-sm font-medium text-surface-700">
                  {PROVIDERS.find((p) => p.id === provider)?.name}
                </p>
              </div>

              <AnimatePresence mode="wait">
                {processing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3 py-6"
                  >
                    <Loader2 className="animate-spin text-brand-500" size={40} />
                    <p className="text-sm text-surface-600">Processing payment...</p>
                  </motion.div>
                )}
                {result === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 py-6 text-green-600"
                  >
                    <CheckCircle2 size={48} />
                    <p className="font-semibold">Payment Successful!</p>
                  </motion.div>
                )}
                {result === 'failure' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 py-6 text-accent-600"
                  >
                    <XCircle size={48} />
                    <p className="font-semibold">Payment Failed</p>
                  </motion.div>
                )}
                {!processing && !result && (
                  <Button
                    type="submit"
                    disabled={!isValid}
                    className="w-full"
                    size="lg"
                  >
                    Pay {currency} {amountNum.toLocaleString()}
                  </Button>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </form>
    </motion.div>
  );
}

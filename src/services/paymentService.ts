import type { PaymentProvider } from '@/types';

interface PaymentConfig {
  provider: PaymentProvider;
  amount: number;
  currency: string;
  description: string;
  email: string;
  metadata?: Record<string, string>;
}

export async function initializeStripePayment(config: PaymentConfig): Promise<{
  clientSecret: string;
  paymentIntentId: string;
}> {
  // In production, this would call your backend/edge function
  // which communicates with Stripe's API using the secret key
  console.log('Initializing Stripe payment:', config);

  // Mock response for development
  return {
    clientSecret: `pi_mock_${Date.now()}_secret`,
    paymentIntentId: `pi_mock_${Date.now()}`,
  };
}

export async function initializePaystackPayment(config: PaymentConfig): Promise<{
  authorizationUrl: string;
  reference: string;
}> {
  const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!PAYSTACK_PUBLIC_KEY || PAYSTACK_PUBLIC_KEY === 'pk_test_xxx') {
    console.log('Initializing Paystack payment (mock):', config);
    return {
      authorizationUrl: `https://paystack.com/pay/mock_${Date.now()}`,
      reference: `ref_mock_${Date.now()}`,
    };
  }

  // In production, initialize transaction via backend
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_PUBLIC_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: config.email,
      amount: config.amount * 100, // Paystack expects amount in kobo
      currency: config.currency,
      reference: `tsw_${Date.now()}`,
      metadata: config.metadata,
    }),
  });

  const data = await response.json();
  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}

export async function verifyPayment(
  provider: PaymentProvider,
  reference: string
): Promise<{ verified: boolean; status: string }> {
  console.log(`Verifying ${provider} payment:`, reference);

  // In production, verify via backend
  return { verified: true, status: 'completed' };
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

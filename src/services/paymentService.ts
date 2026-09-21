import { supabase } from '@/lib/supabase';
import type { Payment, ServicePrice } from '@/types';

/**
 * Payments.
 *
 * Everything money-related happens on the server now. This module used to
 * contain a mocked Stripe call, a Paystack call that sent the *public* key as a
 * bearer token, and a verifyPayment() that returned `{ verified: true }`
 * unconditionally — while the UI wrote `status: 'completed'` straight into the
 * database.
 *
 * The flow is:
 *
 *   1. `startPayment()` names a purpose. The amount comes from the
 *      service_prices catalogue, server-side, and the client cannot influence
 *      it.
 *   2. The user completes payment on Paystack's hosted page.
 *   3. The payments-webhook function verifies the HMAC signature, re-fetches
 *      the transaction from Paystack, checks the amount matches what we priced,
 *      and is the only writer permitted to set `completed`.
 *
 * The client can no longer create or modify a payment row at all — the RLS
 * insert policy is gone and a trigger pins the status column.
 */

export interface StartPaymentInput {
  /** A key from the service_prices table. */
  purpose: string;
  caseId?: string;
  propertyId?: string;
  quantity?: number;
  /** Where Paystack returns the user. Must be an in-app path. */
  callbackPath?: string;
}

export interface StartPaymentResult {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  label: string;
  authorizationUrl: string;
  accessCode?: string;
}

/**
 * Creates a pending payment and returns Paystack's hosted checkout URL.
 * Redirect the browser to `authorizationUrl` — the hosted page is used rather
 * than the inline popup so the result is confirmed by webhook rather than by a
 * client callback we would have to trust.
 */
export async function startPayment(
  input: StartPaymentInput
): Promise<{ data: StartPaymentResult | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('payments-initialize', {
    body: {
      purpose: input.purpose,
      caseId: input.caseId,
      propertyId: input.propertyId,
      quantity: input.quantity ?? 1,
      callbackPath: input.callbackPath ?? '/app/payments/history',
    },
  });

  if (error) {
    // Edge function errors arrive as a FunctionsHttpError whose body holds our
    // message; surface that rather than the generic transport text.
    let message = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) message = body.error as string;
      } catch {
        /* keep the transport message */
      }
    }
    return { data: null, error: message };
  }

  const result = data as StartPaymentResult & { error?: string };
  if (result?.error) return { data: null, error: result.error };
  if (!result?.authorizationUrl) {
    return { data: null, error: 'The payment provider did not return a checkout link.' };
  }
  return { data: result, error: null };
}

/**
 * Reads the authoritative status of a payment from the database.
 *
 * Used after the user returns from Paystack. The row is only ever marked
 * completed by the webhook, so this reflects verified reality — there is no
 * client-side "verify" step to spoof.
 */
export async function getPaymentStatus(
  paymentId: string
): Promise<{ payment: Payment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) return { payment: null, error: error.message };
  return { payment: (data as Payment) ?? null, error: null };
}

/** Same, keyed by the provider reference Paystack appends to the callback URL. */
export async function getPaymentByReference(
  reference: string
): Promise<{ payment: Payment | null; error: string | null }> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('provider_reference', reference)
    .maybeSingle();

  if (error) return { payment: null, error: error.message };
  return { payment: (data as Payment) ?? null, error: null };
}

/**
 * Polls until the webhook settles a payment, or gives up.
 *
 * Webhook delivery is usually immediate but not instantaneous, so the return
 * screen waits briefly rather than telling the user their payment failed.
 */
export async function awaitPaymentSettlement(
  paymentId: string,
  { attempts = 10, intervalMs = 1500 } = {}
): Promise<{ payment: Payment | null; settled: boolean }> {
  for (let i = 0; i < attempts; i++) {
    const { payment } = await getPaymentStatus(paymentId);
    if (payment && payment.status !== 'pending') {
      return { payment, settled: true };
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  const { payment } = await getPaymentStatus(paymentId);
  return { payment, settled: false };
}

/** The purchasable catalogue, for pricing pages and checkout pickers. */
export async function fetchServicePrices(
  module?: ServicePrice['module']
): Promise<{ prices: ServicePrice[]; error: string | null }> {
  let query = supabase
    .from('service_prices')
    .select('*')
    .eq('is_active', true)
    .order('module')
    .order('sort_order');

  if (module) query = query.eq('module', module);

  const { data, error } = await query;
  if (error) return { prices: [], error: error.message };
  return { prices: (data ?? []) as ServicePrice[], error: null };
}

/**
 * Every payment recorded against one case, newest first.
 *
 * RLS on `payments` is `payer_id = auth.uid() OR is_admin()`, so this returns
 * rows to the complainant who paid them and to administrators, and an empty
 * list to an assigned professional. That is deliberate — what the complainant
 * paid is not the investigator's business — and it is why the panel that uses
 * this renders nothing rather than an empty state for those viewers.
 */
export async function fetchCasePayments(
  caseId: string
): Promise<{ payments: Payment[]; error: string | null }> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) return { payments: [], error: error.message };
  return { payments: (data ?? []) as Payment[], error: null };
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Intl throws on an unknown currency code rather than degrading.
    return `${currency} ${amount.toLocaleString()}`;
  }
}

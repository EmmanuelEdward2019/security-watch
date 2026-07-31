/**
 * Paystack webhook — the only writer allowed to mark a payment completed.
 *
 * SECURITY MODEL
 *
 * Runs with verify_jwt = false because Paystack cannot present a Supabase JWT.
 * Authentication is the `x-paystack-signature` header: an HMAC-SHA512 of the
 * raw request body keyed with our secret key. An unsigned or mis-signed request
 * is rejected outright — unlike the auth email hook, there is no fallback here
 * and there must never be one.
 *
 * The webhook also re-fetches the transaction from Paystack rather than
 * trusting the amount in the payload, and cross-checks it against the amount we
 * recorded at initialization. A payer who tampers with the hosted page cannot
 * under-pay their way to a completed status.
 *
 * Deploy: supabase functions deploy payments-webhook --no-verify-jwt
 * Paystack dashboard → Settings → API Keys & Webhooks → Webhook URL
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface PaystackEvent {
  event: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    gateway_response?: string;
    metadata?: Record<string, unknown>;
  };
}

/** Constant-time comparison so a timing side channel cannot leak the digest. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!PAYSTACK_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
    console.error('[payments-webhook] Missing required secrets');
    return new Response('Not configured', { status: 500 });
  }

  // Read the body exactly once, as text — the signature covers these bytes.
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature') ?? '';

  if (!signature) {
    console.warn('[payments-webhook] REJECTED — no signature header');
    return new Response('Unauthorized', { status: 401 });
  }

  const expected = await hmacSha512Hex(PAYSTACK_SECRET, rawBody);
  if (!timingSafeEqual(signature.toLowerCase(), expected)) {
    console.warn('[payments-webhook] REJECTED — signature mismatch');
    return new Response('Unauthorized', { status: 401 });
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) {
    // Signed but irrelevant (e.g. a subscription event). Acknowledge so
    // Paystack stops retrying.
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: payment } = await admin
      .from('payments')
      .select('id, payer_id, amount, currency, status, purpose, case_id, property_id')
      .eq('provider_reference', reference)
      .maybeSingle();

    if (!payment) {
      console.warn('[payments-webhook] Unknown reference:', reference);
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // Idempotency: Paystack retries, and a settled payment must not be reopened.
    if (payment.status === 'completed' || payment.status === 'refunded') {
      return new Response(JSON.stringify({ received: true, alreadySettled: true }), { status: 200 });
    }

    if (event.event === 'charge.failed') {
      await admin
        .from('payments')
        .update({ status: 'failed', provider_payload: event.data ?? {} })
        .eq('id', payment.id);
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    if (event.event !== 'charge.success') {
      return new Response(JSON.stringify({ received: true, ignored: event.event }), { status: 200 });
    }

    // Do not trust the amount in the webhook body — ask Paystack directly.
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    const verifyJson = await verifyRes.json().catch(() => null) as
      | { status?: boolean; data?: { status?: string; amount?: number; currency?: string; paid_at?: string } }
      | null;

    const verified = verifyJson?.data;
    if (!verifyRes.ok || !verifyJson?.status || verified?.status !== 'success') {
      console.warn('[payments-webhook] Verification did not confirm success:', reference);
      await admin
        .from('payments')
        .update({ status: 'failed', provider_payload: verifyJson ?? {} })
        .eq('id', payment.id);
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    // The charge must match what we priced. Minor-unit comparison, 1 unit slack
    // for rounding.
    const expectedMinor = Math.round(Number(payment.amount) * 100);
    const paidMinor = Number(verified.amount ?? 0);

    if (Math.abs(paidMinor - expectedMinor) > 1 || verified.currency !== payment.currency) {
      console.error(
        '[payments-webhook] AMOUNT MISMATCH on', reference,
        'expected', expectedMinor, payment.currency,
        'got', paidMinor, verified.currency
      );
      await admin.from('payments').update({
        status: 'failed',
        provider_payload: { reason: 'amount_mismatch', expectedMinor, paidMinor, verified },
      }).eq('id', payment.id);

      await admin.from('audit_logs').insert({
        user_id: payment.payer_id,
        action: 'payment_amount_mismatch',
        resource_type: 'payment',
        resource_id: payment.id,
        details: { reference, expectedMinor, paidMinor },
        severity: 'critical',
      });
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    await admin
      .from('payments')
      .update({
        status: 'completed',
        verified_at: new Date().toISOString(),
        provider_payload: verified,
      })
      .eq('id', payment.id);

    await admin.from('notifications').insert({
      user_id: payment.payer_id,
      title: 'Payment confirmed',
      message: `We received your payment of ${payment.currency} ${Number(payment.amount).toLocaleString()}.`,
      type: 'success',
      link: '/app/payments/history',
    });

    // A verification purchase moves the property into the admin review queue.
    if (payment.purpose === 'property_verification' && payment.property_id) {
      await admin
        .from('property_verification_requests')
        .update({ status: 'in_review', payment_id: payment.id })
        .eq('property_id', payment.property_id)
        .eq('requester_id', payment.payer_id)
        .eq('status', 'pending');
    }

    // Confirmation email, best effort — never block the acknowledgement.
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUserId: payment.payer_id,
          template: 'payment_received',
          data: {
            amount: `${payment.currency} ${Number(payment.amount).toLocaleString()}`,
            currency: payment.currency,
            reference,
          },
        }),
      });
    } catch (mailErr) {
      console.warn('[payments-webhook] Receipt email failed:', (mailErr as Error).message);
    }

    return new Response(JSON.stringify({ received: true, settled: true }), { status: 200 });
  } catch (err) {
    console.error('[payments-webhook]', (err as Error).message);
    // 500 makes Paystack retry, which is what we want on a transient fault.
    return new Response('Error', { status: 500 });
  }
});

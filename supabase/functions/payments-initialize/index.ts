/**
 * Starts a Paystack transaction and records the intent.
 *
 * SECURITY MODEL
 *
 * Payments used to be entirely self-declared: the browser opened the Paystack
 * popup and then wrote `status: 'completed'` straight into the payments table,
 * with the amount taken from a free-text field the user typed. There was no
 * webhook, no server-side lookup, and the verifyPayment() helper returned
 * `{ verified: true }` unconditionally. Any user could unlock a paid service
 * without money moving.
 *
 * The flow is now:
 *
 *   1. Client asks for a purpose key (never an amount).
 *   2. This function prices it from the service_prices catalogue, creates a
 *      `pending` payment row, and initializes the transaction with Paystack
 *      using the SECRET key — which never reaches the browser.
 *   3. The user pays on Paystack's hosted page.
 *   4. `payments-webhook` verifies the signature and is the only writer that
 *      may mark a payment completed.
 *
 * The client cannot influence the amount, the status, or the reference.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://thesecuritywatch.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin)
    || /^http:\/\/localhost:\d+$/.test(origin)
    || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0] ?? '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

interface InitBody {
  /** A key from service_prices. The amount is never accepted from the client. */
  purpose: string;
  caseId?: string;
  propertyId?: string;
  /** Quantity for per-unit services; clamped to a sane range. */
  quantity?: number;
  callbackPath?: string;
}

/** Paystack rejects currencies a merchant is not enabled for; keep the set tight. */
const SUPPORTED_CURRENCIES = new Set(['NGN', 'GHS', 'ZAR', 'KES', 'USD']);

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY');
  const SITE_URL = Deno.env.get('SITE_URL') ?? ALLOWED_ORIGINS[0] ?? '';

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return json({ error: 'Function is not configured' }, 500, cors);
  }
  if (!PAYSTACK_SECRET) {
    console.error('[payments-initialize] PAYSTACK_SECRET_KEY is not set');
    return json({ error: 'Payments are not configured yet' }, 503, cors);
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token === SERVICE_KEY) {
    // A payment must belong to a real signed-in payer.
    return json({ error: 'Authentication required' }, 401, cors);
  }

  try {
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await asCaller.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return json({ error: 'Authentication required' }, 401, cors);
    }

    const body = (await req.json()) as InitBody;
    if (!body?.purpose || typeof body.purpose !== 'string') {
      return json({ error: 'A purpose is required' }, 400, cors);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin
      .from('profiles')
      .select('email, full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const payerEmail = profile?.email ?? user.email;
    if (!payerEmail) {
      return json({ error: 'Your account has no email address on file' }, 400, cors);
    }

    // --- Price server-side. This is the whole point of the function. ---
    const { data: price } = await admin
      .from('service_prices')
      .select('key, label, amount, currency, module, is_active')
      .eq('key', body.purpose)
      .eq('is_active', true)
      .maybeSingle();

    if (!price) {
      return json({ error: 'That service is not available for purchase' }, 400, cors);
    }
    if (!SUPPORTED_CURRENCIES.has(price.currency)) {
      return json({ error: `Unsupported currency: ${price.currency}` }, 400, cors);
    }

    const quantity = Math.min(Math.max(Math.floor(Number(body.quantity) || 1), 1), 20);
    const amount = Number(price.amount) * quantity;
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'Could not price that service' }, 400, cors);
    }

    // --- Validate the linked resource belongs to the caller ---
    if (body.caseId) {
      const { data: ok } = await asCaller.rpc('is_case_participant', { p_case_id: body.caseId });
      if (ok !== true) {
        return json({ error: 'You are not a participant on that case' }, 403, cors);
      }
    }
    if (body.propertyId) {
      const { data: property } = await admin
        .from('properties')
        .select('id, is_active')
        .eq('id', body.propertyId)
        .maybeSingle();
      if (!property) {
        return json({ error: 'That property does not exist' }, 400, cors);
      }
    }

    // Reference is generated here, never accepted from the client, so a payer
    // cannot collide with or claim someone else's transaction.
    const reference = `tsw_${crypto.randomUUID().replace(/-/g, '')}`;

    const { data: payment, error: paymentErr } = await admin
      .from('payments')
      .insert({
        payer_id: user.id,
        case_id: body.caseId ?? null,
        property_id: body.propertyId ?? null,
        amount,
        currency: price.currency,
        provider: 'paystack',
        provider_reference: reference,
        status: 'pending',
        purpose: price.key,
        description: quantity > 1 ? `${price.label} × ${quantity}` : price.label,
      })
      .select('id')
      .single();

    if (paymentErr || !payment) {
      console.error('[payments-initialize] Could not record intent:', paymentErr?.message);
      return json({ error: 'Could not start the payment' }, 500, cors);
    }

    const callbackPath = typeof body.callbackPath === 'string'
      && body.callbackPath.startsWith('/')
      ? body.callbackPath
      : '/app/payments/history';

    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: payerEmail,
        // Paystack takes the minor unit (kobo for NGN, cents for USD).
        amount: Math.round(amount * 100),
        currency: price.currency,
        reference,
        callback_url: `${SITE_URL}${callbackPath}`,
        metadata: {
          payment_id: payment.id,
          payer_id: user.id,
          purpose: price.key,
          case_id: body.caseId ?? null,
          property_id: body.propertyId ?? null,
        },
      }),
    });

    const initJson = await initRes.json().catch(() => null) as
      | { status?: boolean; message?: string; data?: { authorization_url?: string; access_code?: string } }
      | null;

    if (!initRes.ok || !initJson?.status || !initJson.data?.authorization_url) {
      console.error('[payments-initialize] Paystack rejected:', initJson?.message);
      await admin
        .from('payments')
        .update({ status: 'failed', provider_payload: initJson ?? {} })
        .eq('id', payment.id);
      return json({ error: initJson?.message ?? 'The payment provider declined' }, 502, cors);
    }

    return json(
      {
        paymentId: payment.id,
        reference,
        amount,
        currency: price.currency,
        label: price.label,
        authorizationUrl: initJson.data.authorization_url,
        accessCode: initJson.data.access_code,
      },
      200,
      cors
    );
  } catch (err) {
    console.error('[payments-initialize]', (err as Error).message);
    return json({ error: 'Unexpected error' }, 500, cors);
  }
});

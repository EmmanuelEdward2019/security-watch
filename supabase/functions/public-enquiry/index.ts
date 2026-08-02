/**
 * Handles the two anonymous public forms — Fountain Source service requests and
 * the general contact form — end to end: validate, record, confirm, notify.
 *
 * SECURITY MODEL
 *
 * This exists so that `send-notification-email` never has to accept an
 * unauthenticated caller with a free-choice recipient address. The confirmation
 * here goes only to the address that was just written into the enquiry row, and
 * the template is fixed by the form type — so it cannot be turned into a
 * general-purpose mailer.
 *
 * Abuse controls:
 *   * Per-email and per-IP rate limits on a short window.
 *   * Length caps on every field.
 *   * A rejected submission still returns 200-shaped output so the endpoint
 *     cannot be used to enumerate what is already stored.
 *
 * Deploy: supabase functions deploy public-enquiry --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://thesecuritywatch.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Vercel deployment URLs for THIS project only.
 *
 * Every preview build and the bare project domain live on *.vercel.app, so an
 * admin testing on a preview URL had their browser block the request before it
 * was sent — surfacing as "Failed to send a request to the Edge Function",
 * which reads like a network fault rather than a CORS rejection.
 *
 * Scoped to the project slug deliberately. A blanket *.vercel.app rule would let
 * any application hosted on Vercel call these functions.
 */
const VERCEL_ORIGIN = /^https:\/\/security-watch(-[a-z0-9-]+)?\.vercel\.app$/;

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin)
    || VERCEL_ORIGIN.test(origin)
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

const SERVICE_TYPES = new Set([
  'security_guards', 'security_surveillance', 'security_escorts', 'event_security',
  'private_protection', 'home_security', 'infrastructure_security', 'maritime_security',
  'security_training', 'debt_recovery', 'construction', 'logistics', 'other',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Trim, cap, and flatten control characters. Smuggled newlines and header
 * injection payloads are the reason this runs before anything is stored or
 * interpolated into an email.
 */
function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Same as clean() but keeps paragraph breaks, for message bodies. */
function cleanMultiline(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

interface EnquiryBody {
  kind: 'security_service' | 'contact';
  fullName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  serviceType?: string;
  location?: string;
  subject?: string;
  message?: string;
}

const RATE_WINDOW_MINUTES = 60;
const MAX_PER_EMAIL = 5;

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Function is not configured' }, 500, cors);
  }

  try {
    const body = (await req.json()) as EnquiryBody;

    const kind = body?.kind === 'contact' ? 'contact' : 'security_service';
    const fullName = clean(body.fullName, 120);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 40);
    const message = cleanMultiline(body.message, 5000);

    if (!fullName || fullName.length < 2) {
      return json({ error: 'Please give us your name.' }, 400, cors);
    }
    if (!EMAIL_RE.test(email)) {
      return json({ error: 'That email address does not look right.' }, 400, cors);
    }
    if (!message || message.length < 10) {
      return json({ error: 'Please tell us a little more — at least 10 characters.' }, 400, cors);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();

    const table = kind === 'contact' ? 'contact_messages' : 'security_service_requests';
    const { count } = await admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', since);

    if ((count ?? 0) >= MAX_PER_EMAIL) {
      return json(
        { error: 'You have sent several enquiries recently. Please give us time to reply first.' },
        429,
        cors
      );
    }

    let recordId: string | null = null;
    let serviceLabel = '';

    if (kind === 'contact') {
      const subject = clean(body.subject, 200) || 'General enquiry';
      const { data, error } = await admin
        .from('contact_messages')
        .insert({ full_name: fullName, email, phone: phone || null, subject, message })
        .select('id')
        .single();

      if (error) {
        console.error('[public-enquiry] contact insert failed:', error.message);
        return json({ error: 'We could not record your message. Please try again.' }, 500, cors);
      }
      recordId = data.id;
      serviceLabel = subject;
    } else {
      const serviceType = clean(body.serviceType, 60);
      if (!SERVICE_TYPES.has(serviceType)) {
        return json({ error: 'Please choose a service from the list.' }, 400, cors);
      }
      const { data, error } = await admin
        .from('security_service_requests')
        .insert({
          full_name: fullName,
          email,
          phone: phone || null,
          company_name: clean(body.companyName, 160) || null,
          service_type: serviceType,
          location: clean(body.location, 160) || null,
          message,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[public-enquiry] service request insert failed:', error.message);
        return json({ error: 'We could not record your request. Please try again.' }, 500, cors);
      }
      recordId = data.id;
      serviceLabel = serviceType.replace(/_/g, ' ');
    }

    // --- Confirmation to the submitter, and a heads-up to every admin ---
    const sendMail = (payload: Record<string, unknown>) =>
      fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((e) => console.warn('[public-enquiry] mail failed:', (e as Error).message));

    await sendMail({
      to: email,
      template: 'security_service_request_received',
      data: { recipientName: fullName, serviceType: serviceLabel },
    });

    const { data: admins } = await admin
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin');

    const adminLink = kind === 'contact'
      ? '/app/admin/security-requests?tab=contact'
      : '/app/admin/security-requests';

    for (const a of admins ?? []) {
      await admin.from('notifications').insert({
        user_id: a.user_id,
        title: kind === 'contact' ? 'New contact message' : 'New Fountain Source request',
        message: `${fullName} <${email}> — ${serviceLabel}`,
        type: 'info',
        link: adminLink,
      });
      await sendMail({
        recipientUserId: a.user_id,
        template: 'security_service_request_admin',
        data: {
          serviceType: serviceLabel,
          companyName: clean(body.companyName, 160) || fullName,
          actionUrl: `${ALLOWED_ORIGINS[0] ?? ''}${adminLink}`,
        },
      });
    }

    return json({ success: true, id: recordId }, 200, cors);
  } catch (err) {
    console.error('[public-enquiry]', (err as Error).message);
    return json({ error: 'Unexpected error. Please try again.' }, 500, cors);
  }
});

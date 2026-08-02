/**
 * Transactional / notification emails via Resend.
 * Helpers are inlined so remote deploy bundles a single module.
 */
// --- baseHtml (branded layout) ---
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const BRAND = {
  name: 'The Security Watch',
  tagline: 'Investigative services · Property verification · Institutional transparency',
  primary: '#166534',
  primaryDark: '#14532d',
  surface: '#f8fafc',
  text: '#0f172a',
  muted: '#64748b',
};

function emailShell(opts: {
  title: string;
  preheader?: string;
  innerHtml: string;
}): string {
  const pre = opts.preheader
    ? `<div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};font-family:Georgia,'Times New Roman',serif;-webkit-font-smoothing:antialiased;">
  ${pre}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.surface};padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND.primaryDark} 0%,${BRAND.primary} 100%);padding:28px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.85);font-family:system-ui,sans-serif;">${escapeHtml(BRAND.name)}</p>
              <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;font-family:system-ui,sans-serif;">${escapeHtml(opts.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.65;color:${BRAND.text};font-family:system-ui,-apple-system,sans-serif;">
              ${opts.innerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;font-size:12px;line-height:1.5;color:${BRAND.muted};font-family:system-ui,sans-serif;border-top:1px solid #e2e8f0;">
              <p style="margin:20px 0 8px;">${escapeHtml(BRAND.tagline)}</p>
              <p style="margin:0;">This message was sent by ${escapeHtml(BRAND.name)}. If you did not request this email, you can safely ignore it.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;font-family:system-ui,sans-serif;">© ${new Date().getFullYear()} ${escapeHtml(BRAND.name)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  const safe = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background:${BRAND.primary};">
        <a href="${safe}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:system-ui,sans-serif;">${safeLabel}</a>
      </td>
    </tr>
  </table>`;
}

// --- Resend ---
async function sendWithResend(opts: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  const data = (await res.json()) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    return { ok: false, error: JSON.stringify(data) };
  }
  return { ok: true, id: data.id };
}

function getResendFrom(): string {
  return Deno.env.get('RESEND_FROM_EMAIL') ?? 'The Security Watch <onboarding@resend.dev>';
}

// --- Transactional templates ---
type TransactionalTemplateId =
  | 'payment_received'
  | 'payment_failed'
  | 'case_assigned'
  | 'case_status_update'
  | 'new_message'
  | 'verification_submitted'
  | 'verification_approved'
  | 'verification_rejected'
  | 'security_service_request_received'
  | 'security_service_request_admin'
  | 'investigator_matched'
  | 'report_ready'
  | 'institution_report_published'
  | 'generic_notification';

interface TemplatePayload {
  recipientName?: string;
  amount?: string;
  currency?: string;
  reference?: string;
  caseTitle?: string;
  caseId?: string;
  status?: string;
  messagePreview?: string;
  conversationId?: string;
  serviceType?: string;
  companyName?: string;
  dashboardUrl?: string;
  actionUrl?: string;
  extraNote?: string;
}

function renderTransactionalEmail(
  template: TransactionalTemplateId,
  data: TemplatePayload
): { subject: string; html: string } {
  const name = data.recipientName ? escapeHtml(data.recipientName) : 'there';
  const site = data.dashboardUrl || 'https://thesecuritywatch.com';

  switch (template) {
    case 'payment_received':
      return {
        subject: `Payment received — ${data.reference || 'The Security Watch'}`,
        html: emailShell({
          title: 'Payment confirmed',
          preheader: `Your payment of ${data.amount || ''} was received.`,
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">We have successfully received your payment.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Amount</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${escapeHtml(data.amount || '—')}</td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Reference</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(data.reference || '—')}</td></tr>
            </table>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'View receipt') : ''}`,
        }),
      };
    case 'payment_failed':
      return {
        subject: 'Payment could not be completed — The Security Watch',
        html: emailShell({
          title: 'Payment unsuccessful',
          preheader: 'We could not process your payment.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">Your recent payment attempt did not complete. No charge has been made. Please try again or use a different method.</p>
            ${data.extraNote ? `<p style="margin:0 0 16px;color:#64748b;font-size:14px;">${escapeHtml(data.extraNote)}</p>` : ''}
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Retry payment') : ''}`,
        }),
      };
    case 'case_assigned':
      return {
        subject: `Case assigned: ${data.caseTitle || 'Your case'}`,
        html: emailShell({
          title: 'A professional has been assigned',
          preheader: 'Your case is now active.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">A verified investigator or specialist has been assigned to <strong>${escapeHtml(data.caseTitle || 'your case')}</strong>.</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Open case') : ctaButton(site + '/app/cases', 'Go to dashboard')}`,
        }),
      };
    case 'case_status_update':
      return {
        subject: `Case update: ${data.caseTitle || 'The Security Watch'}`,
        html: emailShell({
          title: 'Case status update',
          preheader: data.status || 'Your case was updated.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">The status of <strong>${escapeHtml(data.caseTitle || 'your case')}</strong> is now: <strong>${escapeHtml(data.status || 'Updated')}</strong>.</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'View case') : ''}`,
        }),
      };
    case 'new_message':
      return {
        subject: `New message${data.caseTitle ? ` — ${data.caseTitle}` : ''}`,
        html: emailShell({
          title: 'You have a new message',
          preheader: data.messagePreview || '',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">You received a new message in your secure inbox.</p>
            ${data.messagePreview ? `<blockquote style="margin:16px 0;padding:12px 16px;background:#f1f5f9;border-left:4px solid #166534;font-size:14px;color:#334155;">${escapeHtml(data.messagePreview)}</blockquote>` : ''}
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Open messages') : ctaButton(site + '/app/messages', 'Open messages')}`,
        }),
      };
    case 'verification_submitted':
      return {
        subject: 'We received your verification documents',
        html: emailShell({
          title: 'Documents received',
          preheader: 'Your verification is under review.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">Thank you for submitting your verification materials. Our team will review them and notify you of the outcome.</p>`,
        }),
      };
    case 'verification_approved':
      return {
        subject: 'Verification approved — The Security Watch',
        html: emailShell({
          title: 'Verification approved',
          preheader: 'Your profile is verified.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">Your verification has been approved. You now have access to the full range of platform features for your role.</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Go to dashboard') : ''}`,
        }),
      };
    case 'verification_rejected':
      return {
        subject: 'Verification update — action required',
        html: emailShell({
          title: 'Verification needs attention',
          preheader: 'Please review and resubmit.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">We could not approve your verification with the documents provided.${data.extraNote ? ` Note: ${escapeHtml(data.extraNote)}` : ''}</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Update profile') : ''}`,
        }),
      };
    case 'security_service_request_received':
      return {
        subject: 'We received your Fountain Source request',
        html: emailShell({
          title: 'Request received',
          preheader: 'Fountain Source Ltd will follow up shortly.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">Thank you for contacting Fountain Source Ltd (The Security Watch). Your request for <strong>${escapeHtml(data.serviceType || 'services')}</strong> has been logged.</p>
            <p style="margin:0;">Our team typically responds within 24 hours.</p>`,
        }),
      };
    case 'security_service_request_admin':
      return {
        subject: `New Fountain Source request: ${data.serviceType || 'General'}`,
        html: emailShell({
          title: 'New security service request',
          preheader: 'Review in admin dashboard.',
          innerHtml: `<p style="margin:0 0 16px;">A new Fountain Source service request was submitted.</p>
            <table style="width:100%;font-size:14px;margin:12px 0;">
              <tr><td style="color:#64748b;padding:4px 0;">Service</td><td>${escapeHtml(data.serviceType || '—')}</td></tr>
              <tr><td style="color:#64748b;padding:4px 0;">Company</td><td>${escapeHtml(data.companyName || '—')}</td></tr>
            </table>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Open in dashboard') : ''}`,
        }),
      };
    case 'investigator_matched':
      return {
        subject: 'You were matched to a case',
        html: emailShell({
          title: 'New case match',
          preheader: 'A case may be assigned to you.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">You have been matched to a new matter: <strong>${escapeHtml(data.caseTitle || 'Case')}</strong>. Please review and accept in your dashboard.</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Review case') : ''}`,
        }),
      };
    case 'report_ready':
      return {
        subject: 'Your report is ready',
        html: emailShell({
          title: 'Report available',
          preheader: 'Download your document.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">The report you requested is ready.</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'View report') : ''}`,
        }),
      };
    case 'institution_report_published':
      return {
        subject: 'Institution report published',
        html: emailShell({
          title: 'New transparency content',
          preheader: 'An institution assessment was published.',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">New institutional transparency content is available on the platform.</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'View') : ''}`,
        }),
      };
    default:
      return {
        subject: 'Notification — The Security Watch',
        html: emailShell({
          title: 'Notification',
          preheader: '',
          innerHtml: `<p style="margin:0 0 16px;">Hello ${name},</p>
            <p style="margin:0 0 16px;">${escapeHtml(data.extraNote || 'You have a new notification.')}</p>
            ${data.actionUrl ? ctaButton(data.actionUrl, 'Open') : ''}`,
        }),
      };
  }
}

// --- HTTP handler ---
//
// SECURITY MODEL
//
// This endpoint used to accept `{ to, subject, html }` from anyone holding the
// anon key — which ships in the browser bundle — with `Access-Control-Allow-
// Origin: *`. That is an open relay: arbitrary HTML, to an arbitrary address,
// sent from our verified sending domain.
//
// It now works like this:
//
//   * A caller must present a real user JWT. The anon key alone is not enough.
//   * Only templates are renderable. The raw-HTML branch is gone, so the body
//     of an email can never be attacker-controlled.
//   * Recipients are addressed by user id, never by email address. The address
//     is resolved server-side from `profiles`.
//   * A non-admin caller may only email someone they share a case, a
//     conversation, or a property enquiry with — enforced by asking the
//     database, as the caller, via shares_context_with().
//
// Public, unauthenticated enquiry confirmations are handled by the
// `public-enquiry` function instead, which owns both the insert and the email
// so the recipient is never simply whatever the request asked for.
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

interface InvokeBody {
  /** Preferred: resolve the address server-side from this user's profile. */
  recipientUserId?: string;
  /** Admin and service-role callers only. */
  to?: string;
  template: TransactionalTemplateId;
  data?: TemplatePayload;
}

const VALID_TEMPLATES = new Set<string>([
  'payment_received', 'payment_failed', 'case_assigned', 'case_status_update',
  'new_message', 'verification_submitted', 'verification_approved',
  'verification_rejected', 'security_service_request_received',
  'security_service_request_admin', 'investigator_matched', 'report_ready',
  'institution_report_published', 'generic_notification',
]);

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, cors);
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!RESEND_API_KEY || !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('[send-notification-email] Missing required secrets');
    return json({ error: 'Email service is not configured' }, 500, cors);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'Authentication required' }, 401, cors);
  }

  try {
    const body = (await req.json()) as InvokeBody;

    if (!body?.template || !VALID_TEMPLATES.has(body.template)) {
      return json({ error: 'A known template id is required' }, 400, cors);
    }

    const isServiceRole = token === SERVICE_KEY;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let recipientEmail: string | null = null;
    let recipientName: string | undefined;

    if (isServiceRole) {
      // Server-to-server: our own webhooks and scheduled jobs.
      if (body.recipientUserId) {
        const { data } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', body.recipientUserId)
          .maybeSingle();
        recipientEmail = data?.email ?? null;
        recipientName = data?.full_name ?? undefined;
      } else if (body.to) {
        recipientEmail = body.to;
      }
    } else {
      // Resolve the caller. A bare anon key has no user and is rejected here.
      const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: userData, error: userErr } = await asCaller.auth.getUser();
      const caller = userData?.user;
      if (userErr || !caller) {
        return json({ error: 'Authentication required' }, 401, cors);
      }

      const { data: callerProfile } = await admin
        .from('profiles')
        .select('role, full_name, email')
        .eq('user_id', caller.id)
        .maybeSingle();

      const callerIsAdmin = callerProfile?.role === 'admin';

      if (body.recipientUserId) {
        if (body.recipientUserId === caller.id) {
          recipientEmail = callerProfile?.email ?? caller.email ?? null;
          recipientName = callerProfile?.full_name ?? undefined;
        } else if (callerIsAdmin) {
          const { data } = await admin
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', body.recipientUserId)
            .maybeSingle();
          recipientEmail = data?.email ?? null;
          recipientName = data?.full_name ?? undefined;
        } else {
          // Ask the database, as the caller, whether they share any context
          // with the intended recipient. This is the check that stops the
          // function being used to mail strangers.
          const { data: shares, error: sharesErr } = await asCaller.rpc(
            'shares_context_with',
            { p_user_id: body.recipientUserId }
          );
          if (sharesErr || shares !== true) {
            return json(
              { error: 'You cannot send mail to that recipient' },
              403,
              cors
            );
          }
          const { data } = await admin
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', body.recipientUserId)
            .maybeSingle();
          recipientEmail = data?.email ?? null;
          recipientName = data?.full_name ?? undefined;
        }
      } else if (body.to) {
        // A free-form address is an admin-only capability.
        if (!callerIsAdmin) {
          return json(
            { error: 'Address recipients by recipientUserId, not by email' },
            403,
            cors
          );
        }
        recipientEmail = body.to;
      }
    }

    if (!recipientEmail) {
      return json({ error: 'Could not resolve a recipient' }, 400, cors);
    }

    const { subject, html } = renderTransactionalEmail(body.template, {
      ...(body.data ?? {}),
      // Never let the caller spoof the greeting name when we know the real one.
      recipientName: recipientName ?? body.data?.recipientName,
    });

    const result = await sendWithResend({
      apiKey: RESEND_API_KEY,
      from: getResendFrom(),
      to: recipientEmail,
      subject,
      html,
    });

    if (!result.ok) {
      console.error('[send-notification-email] Resend failed:', result.error);
      return json({ error: 'Email delivery failed' }, 502, cors);
    }

    return json({ success: true, id: result.id }, 200, cors);
  } catch (err) {
    console.error('[send-notification-email] Unexpected error:', (err as Error).message);
    return json({ error: 'Unexpected error' }, 500, cors);
  }
});

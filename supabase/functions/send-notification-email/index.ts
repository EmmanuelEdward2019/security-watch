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
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Legacy: raw HTML */
interface LegacyPayload {
  to: string;
  subject: string;
  html: string;
  template?: never;
}

/** Templated transactional email */
interface TemplatedPayload {
  to: string;
  template: TransactionalTemplateId;
  data?: TemplatePayload;
  subject?: never;
  html?: never;
}

type InvokeBody = LegacyPayload | TemplatedPayload;

function isTemplated(b: InvokeBody): b is TemplatedPayload {
  return typeof (b as TemplatedPayload).template === 'string';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as InvokeBody;

    if (!body.to) {
      return new Response(JSON.stringify({ error: 'to is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const from = getResendFrom();
    let subject: string;
    let html: string;

    if (isTemplated(body)) {
      const out = renderTransactionalEmail(body.template, body.data ?? {});
      subject = out.subject;
      html = out.html;
    } else {
      if (!body.subject || !body.html) {
        return new Response(
          JSON.stringify({ error: 'Either (template + optional data) or (subject + html) is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      subject = body.subject;
      html = body.html;
    }

    const result = await sendWithResend({
      apiKey: RESEND_API_KEY,
      from,
      to: body.to,
      subject,
      html,
    });

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

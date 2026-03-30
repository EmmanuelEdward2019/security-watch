/**
 * Supabase Auth "Send Email" hook — sends branded emails via Resend instead of default Supabase templates.
 *
 * Dashboard: Authentication → Hooks → Send Email → HTTPS → this function URL
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL, SEND_EMAIL_HOOK_SECRET, SUPABASE_URL
 *
 * Deploy: supabase functions deploy auth-send-email --no-verify-jwt
 *
 * Note: All helpers are inlined in this file so remote deploy bundles a single module (Supabase
 * server-side bundling does not reliably include sibling .ts files).
 */
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

// --- baseHtml (branded layout) ---
/** Shared branded HTML shell for Resend / email clients */

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

function codeBlock(code: string): string {
  return `<p style="margin:16px 0;font-size:22px;letter-spacing:0.25em;font-weight:700;font-family:ui-monospace,monospace;color:${BRAND.primaryDark};text-align:center;padding:16px;background:#f1f5f9;border-radius:8px;border:1px dashed #cbd5e1;">${escapeHtml(code)}</p>
  <p style="margin:0;font-size:13px;color:${BRAND.muted};text-align:center;">Enter this code if the button does not work.</p>`;
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

// --- Auth email templates ---
function buildAuthVerifyUrl(
  supabaseUrl: string,
  emailData: {
    token_hash: string;
    email_action_type: string;
    redirect_to: string;
  }
): string {
  const base = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`;
  const params = new URLSearchParams({
    token: emailData.token_hash,
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to || '',
  });
  return `${base}?${params.toString()}`;
}

const subjects: Record<string, string> = {
  signup: 'Confirm your email — The Security Watch',
  recovery: 'Reset your password — The Security Watch',
  magiclink: 'Your sign-in link — The Security Watch',
  invite: 'You are invited — The Security Watch',
  email_change: 'Confirm your email change — The Security Watch',
  email: 'Confirm your email — The Security Watch',
  reauthentication: 'Your verification code — The Security Watch',
  password_changed_notification: 'Your password was changed — The Security Watch',
  email_changed_notification: 'Your email was updated — The Security Watch',
  phone_changed_notification: 'Your phone number was updated — The Security Watch',
  identity_linked_notification: 'A sign-in method was linked — The Security Watch',
  identity_unlinked_notification: 'A sign-in method was removed — The Security Watch',
  mfa_factor_enrolled_notification: 'Two-step verification enabled — The Security Watch',
  mfa_factor_unenrolled_notification: 'Two-step verification updated — The Security Watch',
};

function getAuthSubject(emailActionType: string): string {
  return subjects[emailActionType] || 'Notification — The Security Watch';
}

function renderAuthEmail(opts: {
  emailActionType: string;
  confirmationUrl: string;
  token: string;
  siteUrl: string;
  oldEmail?: string;
  newEmail?: string;
}): { subject: string; html: string } {
  const { emailActionType, confirmationUrl, token, siteUrl } = opts;
  const subject = getAuthSubject(emailActionType);

  let title = 'Security notification';
  let body = '';
  let preheader = '';

  switch (emailActionType) {
    case 'signup':
    case 'email':
      title = 'Confirm your email';
      preheader = 'Verify your account to access The Security Watch.';
      body = `<p style="margin:0 0 16px;">Thank you for registering. Please confirm your email address to activate your account and access your dashboard.</p>
        ${ctaButton(confirmationUrl, 'Confirm email address')}
        ${codeBlock(token)}`;
      break;
    case 'recovery':
      title = 'Reset your password';
      preheader = 'Password reset requested for your account.';
      body = `<p style="margin:0 0 16px;">We received a request to reset the password for your account. Click the button below to choose a new password. This link expires after a short time.</p>
        ${ctaButton(confirmationUrl, 'Reset password')}
        ${codeBlock(token)}`;
      break;
    case 'magiclink':
      title = 'Your sign-in link';
      preheader = 'Use this link to sign in without a password.';
      body = `<p style="margin:0 0 16px;">Click the button below to sign in to The Security Watch. If you did not request this link, you can ignore this email.</p>
        ${ctaButton(confirmationUrl, 'Sign in')}
        ${codeBlock(token)}`;
      break;
    case 'invite':
      title = 'You are invited';
      preheader = 'Accept your invitation to join The Security Watch.';
      body = `<p style="margin:0 0 16px;">You have been invited to create an account on The Security Watch (${escapeHtml(siteUrl)}). Click below to accept the invitation.</p>
        ${ctaButton(confirmationUrl, 'Accept invitation')}
        ${codeBlock(token)}`;
      break;
    case 'email_change':
      title = 'Confirm email change';
      preheader = 'Confirm the update to your email address.';
      body = `<p style="margin:0 0 16px;">A request was made to change the email address on your account${opts.oldEmail && opts.newEmail ? ` from <strong>${escapeHtml(opts.oldEmail)}</strong> to <strong>${escapeHtml(opts.newEmail)}</strong>` : ''}. Use the button or code to confirm.</p>
        ${ctaButton(confirmationUrl, 'Confirm email change')}
        ${codeBlock(token)}`;
      break;
    case 'reauthentication':
      title = 'Verify it is you';
      preheader = 'Your one-time verification code.';
      body = `<p style="margin:0 0 16px;">For your security, please enter this code to continue:</p>${codeBlock(token)}`;
      break;
    case 'password_changed_notification':
      title = 'Password updated';
      preheader = 'Your account password was changed.';
      body = `<p style="margin:0 0 16px;">The password for your The Security Watch account was successfully changed. If this was not you, contact support immediately and secure your account.</p>
        <p style="margin:0;"><a href="${escapeHtml(siteUrl)}" style="color:#166534;">Go to ${escapeHtml(siteUrl)}</a></p>`;
      break;
    case 'email_changed_notification':
      title = 'Email address updated';
      preheader = 'Your sign-in email was changed.';
      body = `<p style="margin:0 0 16px;">The email address on your account was updated. If you did not make this change, please secure your account immediately.</p>`;
      break;
    case 'phone_changed_notification':
      title = 'Phone number updated';
      preheader = 'Your phone number was changed.';
      body = `<p style="margin:0 0 16px;">The phone number on your account was updated. If you did not make this change, contact support.</p>`;
      break;
    case 'identity_linked_notification':
      title = 'Sign-in method linked';
      preheader = 'A new sign-in method was added.';
      body = `<p style="margin:0 0 16px;">A new identity provider was linked to your account. If you did not authorize this, secure your account immediately.</p>`;
      break;
    case 'identity_unlinked_notification':
      title = 'Sign-in method removed';
      preheader = 'A sign-in method was removed.';
      body = `<p style="margin:0 0 16px;">An identity provider was unlinked from your account.</p>`;
      break;
    case 'mfa_factor_enrolled_notification':
      title = 'Two-step verification enabled';
      preheader = 'Extra security was added to your account.';
      body = `<p style="margin:0 0 16px;">A new two-factor authentication method was enrolled on your account.</p>`;
      break;
    case 'mfa_factor_unenrolled_notification':
      title = 'Two-step verification updated';
      preheader = 'Your 2FA settings changed.';
      body = `<p style="margin:0 0 16px;">A two-factor authentication method was removed from your account.</p>`;
      break;
    default:
      title = 'Account notification';
      body = `<p style="margin:0 0 16px;">You have a new notification regarding your account.</p>
        ${confirmationUrl ? ctaButton(confirmationUrl, 'Continue') : ''}
        ${token ? codeBlock(token) : ''}`;
  }

  const html = emailShell({ title, preheader, innerHtml: body });
  return { subject, html };
}

// --- Hook handler ---
function normalizeHookSecret(raw: string): string {
  // Try multiple formats — Supabase dashboard gives different formats:
  // "whsec_abc...", "v1,whsec_abc...", or raw base64
  if (raw.startsWith('v1,whsec_')) return raw.slice(9);
  if (raw.startsWith('whsec_')) return raw.slice(6);
  if (raw.startsWith('v1,')) return raw.slice(3);
  return raw;
}

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
  old_email?: string;
  old_phone?: string;
}

interface HookUser {
  id: string;
  email: string;
  new_email?: string;
  user_metadata?: Record<string, unknown>;
}

interface HookPayload {
  user: HookUser;
  email_data: EmailData;
}

/**
 * CRITICAL: This function MUST always return HTTP 200 to Supabase Auth.
 *
 * If the hook returns a non-200 response, Supabase Auth ABORTS the entire
 * auth operation (signup, login, password reset, etc.). This means:
 *   - Users cannot sign up
 *   - Users get "Invalid email or password" even with correct credentials
 *   - Password reset fails
 *
 * Email-sending failures are logged but never propagated as HTTP errors.
 */
Deno.serve(async (req: Request) => {
  // -- CORS pre-flight --
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // -- Always-200 response helper --
  const ok = () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  // -- Load secrets --
  const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!rawSecret || !resendKey || !supabaseUrl) {
    console.error(
      '[auth-send-email] FATAL — missing env vars.',
      'SEND_EMAIL_HOOK_SECRET:', !!rawSecret,
      'RESEND_API_KEY:', !!resendKey,
      'SUPABASE_URL:', !!supabaseUrl
    );
    // Still return 200 so auth isn't blocked; email just won't send.
    return ok();
  }

  const payloadText = await req.text();
  const headers = Object.fromEntries(req.headers);

  // -- Verify webhook signature (with fallback) --
  let payload: HookPayload;
  try {
    const wh = new Webhook(normalizeHookSecret(rawSecret));
    payload = wh.verify(payloadText, headers) as HookPayload;
    console.log('[auth-send-email] Webhook signature verified ✓');
  } catch (verifyErr) {
    console.warn('[auth-send-email] Webhook signature verification failed:', verifyErr);
    console.warn('[auth-send-email] Falling back to raw JSON parse (check SEND_EMAIL_HOOK_SECRET)');

    try {
      payload = JSON.parse(payloadText) as HookPayload;
    } catch (parseErr) {
      console.error('[auth-send-email] Could not parse payload at all:', parseErr);
      return ok();
    }
  }

  // Safety first: everything else inside try/catch so we NEVER return 500
  try {
    const { user, email_data } = payload;
    
    // If this is triggered by a non-email hook accidentally (like Custom Access Token during login),
    // email_data or user might be missing. Just return 200 safely to not block the request.
    if (!user?.email || !email_data?.email_action_type) {
      console.warn('[auth-send-email] Missing user.email or email_data. Hook might have been triggered by a non-email event (e.g. login). Ignoring safely.');
      return ok();
    }

    const from = getResendFrom();

    // Warn if using test sender — emails will only reach the Resend account owner
    if (from.includes('onboarding@resend.dev') || from.includes('resend.dev')) {
      console.warn(
        '[auth-send-email] ⚠️ Using Resend test sender (onboarding@resend.dev). ' +
        'Emails will ONLY be delivered to the email address on the Resend account. ' +
        'Set RESEND_FROM_EMAIL to a verified domain sender for production.'
      );
    }

    console.log(
      `[auth-send-email] Processing: type=${email_data.email_action_type}, to=${user.email}, from=${from}, redirect_to=${email_data.redirect_to || '(empty)'}, site_url=${email_data.site_url || '(empty)'}`
    );

    const newEmail =
      user.new_email ||
      (typeof user.user_metadata?.new_email === 'string' ? user.user_metadata.new_email : undefined);

    if (
      email_data.email_action_type === 'email_change' &&
      newEmail &&
      email_data.token_hash_new &&
      email_data.token_hash
    ) {
      const redirect = email_data.redirect_to || email_data.site_url || '/';

      const urlOld = buildAuthVerifyUrl(supabaseUrl, {
        token_hash: email_data.token_hash_new,
        email_action_type: 'email_change',
        redirect_to: redirect,
      });
      const urlNew = buildAuthVerifyUrl(supabaseUrl, {
        token_hash: email_data.token_hash,
        email_action_type: 'email_change',
        redirect_to: redirect,
      });

      const { subject: s1, html: h1 } = renderAuthEmail({
        emailActionType: 'email_change',
        confirmationUrl: urlOld,
        token: email_data.token,
        siteUrl: email_data.site_url,
        oldEmail: user.email,
        newEmail,
      });
      const { subject: s2, html: h2 } = renderAuthEmail({
        emailActionType: 'email_change',
        confirmationUrl: urlNew,
        token: email_data.token_new || email_data.token,
        siteUrl: email_data.site_url,
        oldEmail: user.email,
        newEmail,
      });

      const r1 = await sendWithResend({ apiKey: resendKey, from, to: user.email, subject: s1, html: h1 });
      const r2 = await sendWithResend({ apiKey: resendKey, from, to: newEmail, subject: s2, html: h2 });
      if (!r1.ok || !r2.ok) {
        console.error('[auth-send-email] Resend dual-send failed:', r1.error, r2.error);
      } else {
        console.log('[auth-send-email] Email change emails sent ✓ ids:', r1.id, r2.id);
      }
    } else {
      let finalRedirectTo = email_data.redirect_to || email_data.site_url || '/';
      
      // Force reset password to go to the correct page, even if Supabase stripped the URL
      // due to URL allow-list restrictions in the dashboard.
      if (email_data.email_action_type === 'recovery') {
         const siteUrl = email_data.site_url || supabaseUrl;
         finalRedirectTo = `${siteUrl.replace(/\/$/, '')}/reset-password`;
      }

      const confirmationUrl = buildAuthVerifyUrl(supabaseUrl, {
        token_hash: email_data.token_hash,
        email_action_type: email_data.email_action_type,
        redirect_to: finalRedirectTo,
      });

      const { subject, html } = renderAuthEmail({
        emailActionType: email_data.email_action_type,
        confirmationUrl,
        token: email_data.token,
        siteUrl: email_data.site_url || supabaseUrl,
        oldEmail: email_data.old_email,
        newEmail,
      });

      const to = user.email;
      const result = await sendWithResend({ apiKey: resendKey, from, to, subject, html });
      if (!result.ok) {
        console.error(
          `[auth-send-email] Resend FAILED for type=${email_data.email_action_type}, from=${from}, to=${to}:`,
          result.error
        );
      } else {
        console.log('[auth-send-email] Email sent ✓ type:', email_data.email_action_type, 'to:', to, 'id:', result.id);
      }
    }
  } catch (err) {
    // Catch-all: log but still return 200 so auth is not blocked
    console.error('[auth-send-email] Unexpected error:', (err as Error).message, (err as Error).stack);
  }

  // ALWAYS return 200 to Supabase Auth
  return ok();
});

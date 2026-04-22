# Supabase OTP Email Templates

The app now uses 6-digit OTP codes instead of magic links for both sign-up
confirmation and password reset. You must update **two email templates** in the
Supabase dashboard and enable one project setting.

---

## Step 1 — Enable Email OTP (one-time, project-level)

1. Open **Supabase Dashboard → Authentication → Providers → Email**.
2. Make sure **"Confirm email"** is **ON** (so new accounts require verification).
3. Under "Email OTP" (or "OTP Expiry"), set expiry to **`3600`** seconds (60 min) or
   less. The default is usually fine.

> Supabase always generates both a `{{ .ConfirmationURL }}` (link) and a
> `{{ .Token }}` (6-digit OTP) for every auth email. By replacing the link in the
> template with the token, users see the OTP instead of a button/link.

---

## Step 2 — Update "Confirm signup" template

**Path:** Supabase Dashboard → Authentication → Email Templates → **Confirm signup**

Replace the entire body with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email — The Security Watch</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: 'Inter', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
    .header { background: #1b4332; padding: 32px 40px; text-align: center; }
    .header img { height: 56px; margin-bottom: 12px; }
    .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; }
    .header p { color: #a7f3d0; font-size: 13px; margin: 4px 0 0; }
    .body { padding: 40px; }
    .body p { color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    .otp-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 28px 20px; text-align: center; margin: 28px 0; }
    .otp-box .label { font-size: 13px; color: #71717a; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 10px; }
    .otp-box .code { font-size: 42px; font-weight: 800; letter-spacing: 14px; color: #1b4332; font-family: 'Courier New', monospace; }
    .otp-box .expiry { font-size: 12px; color: #a1a1aa; margin-top: 10px; }
    .footer { background: #f4f4f5; padding: 24px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #a1a1aa; margin: 0; }
    .footer a { color: #16a34a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>The Security Watch</h1>
      <p>...your concern</p>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p>
        Thank you for creating an account. Enter the verification code below in the
        app to confirm your email address and access your dashboard.
      </p>
      <div class="otp-box">
        <div class="label">Your verification code</div>
        <div class="code">{{ .Token }}</div>
        <div class="expiry">Expires in 60 minutes</div>
      </div>
      <p>
        If you didn't create an account with The Security Watch, you can safely
        ignore this email.
      </p>
      <p style="margin-bottom:0;">— The Security Watch Team</p>
    </div>
    <div class="footer">
      <p>
        &copy; The Security Watch &nbsp;|&nbsp;
        <a href="{{ .SiteURL }}">Visit our website</a>
      </p>
    </div>
  </div>
</body>
</html>
```

**Subject line:** `Your Security Watch verification code: {{ .Token }}`

---

## Step 3 — Update "Magic Link" template (used for password reset OTP)

**Path:** Supabase Dashboard → Authentication → Email Templates → **Magic Link**

The password-reset OTP is sent via `signInWithOtp()`, which uses the Magic Link
template. Replace it with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password — The Security Watch</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: 'Inter', Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
    .header { background: #1b4332; padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 22px; font-weight: 700; margin: 0; }
    .header p { color: #a7f3d0; font-size: 13px; margin: 4px 0 0; }
    .body { padding: 40px; }
    .body p { color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    .otp-box { background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 28px 20px; text-align: center; margin: 28px 0; }
    .otp-box .label { font-size: 13px; color: #71717a; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 10px; }
    .otp-box .code { font-size: 42px; font-weight: 800; letter-spacing: 14px; color: #9a3412; font-family: 'Courier New', monospace; }
    .otp-box .expiry { font-size: 12px; color: #a1a1aa; margin-top: 10px; }
    .warning { background: #fef2f2; border-left: 3px solid #ef4444; padding: 12px 16px; border-radius: 6px; margin: 20px 0; }
    .warning p { font-size: 13px; color: #b91c1c; margin: 0; }
    .footer { background: #f4f4f5; padding: 24px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #a1a1aa; margin: 0; }
    .footer a { color: #16a34a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>The Security Watch</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="body">
      <p>Hi,</p>
      <p>
        We received a request to reset the password for your account. Enter the
        code below in the app to verify your identity and set a new password.
      </p>
      <div class="otp-box">
        <div class="label">Your password reset code</div>
        <div class="code">{{ .Token }}</div>
        <div class="expiry">Expires in 60 minutes — do not share this code</div>
      </div>
      <div class="warning">
        <p>
          ⚠️ If you did not request a password reset, please ignore this email.
          Your password will not be changed.
        </p>
      </div>
      <p style="margin-bottom:0;">— The Security Watch Team</p>
    </div>
    <div class="footer">
      <p>
        &copy; The Security Watch &nbsp;|&nbsp;
        <a href="{{ .SiteURL }}">Visit our website</a>
      </p>
    </div>
  </div>
</body>
</html>
```

**Subject line:** `Your Security Watch password reset code: {{ .Token }}`

---

## Step 4 — Verify the flow end-to-end

1. **Sign up** with a new email → you should receive a branded email with a 6-digit
   code (no link/button).
2. Copy the code into the verification screen at `/verify-otp?mode=signup`.
3. On success, the dashboard loads for your role.
4. **Forgot password** from login → enter your email → receive the orange-themed
   reset code email.
5. Enter the code at `/verify-otp?mode=recovery` → redirected to `/reset-password`.
6. Set and confirm your new password → redirected to `/login`.

---

## Template variables reference

| Variable | Description |
|---|---|
| `{{ .Token }}` | The 6-digit OTP code |
| `{{ .SiteURL }}` | Your site URL (set in Supabase Auth → URL Configuration) |
| `{{ .ConfirmationURL }}` | The old magic-link URL — **do not use in OTP templates** |

---

## Notes

- Both templates deliberately **omit** `{{ .ConfirmationURL }}` so users cannot
  accidentally bypass the in-app OTP screen by clicking a link.
- If you want to keep the link as a fallback for email clients that block images, you
  can add a plain-text section at the bottom with `{{ .ConfirmationURL }}`.
- The "Confirm signup" and "Magic Link" templates are separate in Supabase, so you
  can style them differently (green for signup, orange for reset) as done above.

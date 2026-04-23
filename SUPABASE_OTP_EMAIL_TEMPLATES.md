# Supabase Email Templates — OTP Only (No Links/Buttons)

Update **two templates** in the Supabase dashboard. Both templates show only the
6-digit code, the logo, and no confirmation button or magic link.

---

## How to open the templates

Supabase Dashboard → **Authentication** → **Email Templates**

---

## Template 1 — "Confirm signup"

**Path:** Authentication → Email Templates → **Confirm signup**

**Subject line:**
```
Your Security Watch verification code: {{ .Token }}
```

**Body — paste this entire block:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email — The Security Watch</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
    .header { background: #1b4332; padding: 28px 40px; text-align: center; }
    .header img { height: 64px; width: 64px; object-fit: contain; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
    .header h1 { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 2px; }
    .header p { color: #a7f3d0; font-size: 13px; margin: 0; }
    .body { padding: 40px; }
    .body p { color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 18px; }
    .otp-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 28px 20px; text-align: center; margin: 28px 0; }
    .otp-label { font-size: 12px; color: #71717a; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; }
    .otp-code { font-size: 46px; font-weight: 800; letter-spacing: 16px; color: #1b4332; font-family: 'Courier New', monospace; }
    .otp-expiry { font-size: 12px; color: #a1a1aa; margin-top: 10px; }
    .footer { background: #f4f4f5; padding: 20px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #a1a1aa; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://thesecuritywatch.com/assets/logo.png" alt="The Security Watch logo" />
      <h1>The Security Watch</h1>
      <p>...your concern</p>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p>
        Thank you for creating an account with The Security Watch. Enter the
        6-digit verification code below in the app to confirm your email address
        and access your dashboard.
      </p>
      <div class="otp-box">
        <div class="otp-label">Your verification code</div>
        <div class="otp-code">{{ .Token }}</div>
        <div class="otp-expiry">Expires in 60 minutes &nbsp;·&nbsp; Do not share this code</div>
      </div>
      <p>
        Open the verification page in the app, type or paste this code into the
        6 boxes, and you will be taken straight to your dashboard.
      </p>
      <p>
        If you did not create an account with The Security Watch, you can safely
        ignore this email. No action is needed.
      </p>
      <p style="margin-bottom:0;">— The Security Watch Team</p>
    </div>
    <div class="footer">
      <p>&copy; The Security Watch &nbsp;·&nbsp; Built for everyday people.</p>
    </div>
  </div>
</body>
</html>
```

---

## Template 2 — "Magic Link" (used for password reset)

> The forgot-password flow calls `signInWithOtp()` which uses the **Magic Link**
> template. This template must also show only the OTP — no magic-link button.

**Path:** Authentication → Email Templates → **Magic Link**

**Subject line:**
```
Your Security Watch password reset code: {{ .Token }}
```

**Body — paste this entire block:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password — The Security Watch</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: Arial, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
    .header { background: #1b4332; padding: 28px 40px; text-align: center; }
    .header img { height: 64px; width: 64px; object-fit: contain; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
    .header h1 { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 2px; }
    .header p { color: #a7f3d0; font-size: 13px; margin: 0; }
    .body { padding: 40px; }
    .body p { color: #52525b; font-size: 15px; line-height: 1.6; margin: 0 0 18px; }
    .otp-box { background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 28px 20px; text-align: center; margin: 28px 0; }
    .otp-label { font-size: 12px; color: #71717a; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; }
    .otp-code { font-size: 46px; font-weight: 800; letter-spacing: 16px; color: #9a3412; font-family: 'Courier New', monospace; }
    .otp-expiry { font-size: 12px; color: #a1a1aa; margin-top: 10px; }
    .warning { background: #fef2f2; border-left: 3px solid #ef4444; border-radius: 6px; padding: 12px 16px; margin: 20px 0; }
    .warning p { font-size: 13px; color: #b91c1c; margin: 0; }
    .footer { background: #f4f4f5; padding: 20px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #a1a1aa; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://thesecuritywatch.com/assets/logo.png" alt="The Security Watch logo" />
      <h1>The Security Watch</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="body">
      <p>Hi,</p>
      <p>
        We received a request to reset the password on your account. Enter the
        6-digit code below in the app to verify your identity and choose a new
        password.
      </p>
      <div class="otp-box">
        <div class="otp-label">Your password reset code</div>
        <div class="otp-code">{{ .Token }}</div>
        <div class="otp-expiry">Expires in 60 minutes &nbsp;·&nbsp; Do not share this code</div>
      </div>
      <div class="warning">
        <p>If you did not request a password reset, please ignore this email. Your password will not be changed.</p>
      </div>
      <p style="margin-bottom:0;">— The Security Watch Team</p>
    </div>
    <div class="footer">
      <p>&copy; The Security Watch &nbsp;·&nbsp; Built for everyday people.</p>
    </div>
  </div>
</body>
</html>
```

---

## Steps to update in Supabase dashboard

1. Go to **Supabase Dashboard → Authentication → Email Templates**
2. Click **Confirm signup**
   - Replace the **Subject** with the subject line above
   - Replace the entire **Body** with Template 1 above
   - Click **Save**
3. Click **Magic Link**
   - Replace the **Subject** with the subject line above
   - Replace the entire **Body** with Template 2 above
   - Click **Save**
4. Test by signing up with a new email — you should receive the branded email with only the 6-digit code and no button.

---

## What changed from the old template

| Old template | New template |
|---|---|
| "Sign in" button / magic link | Removed completely |
| "Click the button below" text | Replaced with code instructions |
| "Enter this code if the button does not work" | Replaced — code is now the only method |
| No logo | Logo added (from thesecuritywatch.com/assets/logo.png) |
| `{{ .ConfirmationURL }}` | Removed — not used at all |
| `{{ .Token }}` shown as fallback | `{{ .Token }}` shown as the primary and only action |

---

## Template variable reference

| Variable | Value |
|---|---|
| `{{ .Token }}` | The 6-digit OTP code |
| `{{ .SiteURL }}` | Your configured site URL |
| `{{ .ConfirmationURL }}` | Old magic-link URL — **do NOT include in these templates** |

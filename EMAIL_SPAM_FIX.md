# Fixing Authentication Emails Going to Spam

> **Note on credentials.** This document previously contained a live Resend API
> key in plaintext. It was committed on 22 April 2026, pushed to GitHub, detected
> by secret scanning, and revoked by Resend.
>
> Never paste a live credential into a document, even a private one. Secret
> scanning covers private repositories too, and anyone with read access — or any
> tool with repository access — sees it. Credentials belong in `.env` (gitignored)
> and in Supabase Edge Function secrets, and nowhere else.

---

Auth emails (sign-up confirmation, password reset) are sent by **Supabase's default
SMTP relay** (`smtp.supabase.io`). That relay is shared across thousands of projects
and has a weak sender reputation — which is exactly why your emails land in spam.

The fix is a one-time setup: route ALL outgoing auth emails through **Resend** using
your own verified domain. Resend already has a working API key in your project.

---

## Step 1 — Verify your sending domain in Resend

1. Go to **resend.com/domains** → Add Domain (e.g. `thesecuritywatch.com` or whatever
   you own).
2. Resend will give you three DNS records to add to your domain registrar:
   - **SPF** `TXT` record: `v=spf1 include:amazonses.com ~all`
   - **DKIM** `TXT` record: `resend._domainkey.<your-domain>`
   - **DMARC** `TXT` record: `_dmarc.<your-domain>` → `v=DMARC1; p=quarantine; ...`
3. After adding the records, click **Verify** in Resend. Allow up to 48 hours for DNS
   propagation (usually under 15 minutes).

> **Why this matters:**  
> SPF tells recipient servers "Resend is allowed to send email for my domain."  
> DKIM adds a cryptographic signature proving the email wasn't tampered with.  
> DMARC tells servers what to do when SPF/DKIM fail. Without all three, even
> legitimate email ends up in spam.

---

## Step 2 — Configure Resend SMTP in Supabase Auth

1. Open **Supabase Dashboard → Authentication → Settings → SMTP**.
2. Toggle **"Enable Custom SMTP"** ON.
3. Fill in:
   | Field | Value |
   |---|---|
   | Sender name | The Security Watch |
   | Sender email | `noreply@<your-verified-domain>` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Minimum interval | `60` (seconds between sends per user) |
   | Username | `resend` (literally the string "resend") |
   | Password | `<RESEND_API_KEY>` ← your Resend API key |
4. Click **Save**.
5. Send a **test email** from the same settings page to confirm delivery.

---

## Step 3 — Update email redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**, make sure these are set:
- **Site URL**: `https://www.thesecuritywatch.com` (your production domain)
- **Redirect URLs** (add all):
  - `https://www.thesecuritywatch.com/login`
  - `https://www.thesecuritywatch.com/reset-password`
  - `http://localhost:5173/login` (for local dev)
  - `http://localhost:5173/reset-password`

---

## Step 4 — Update your Resend API key scope (security)

Your current Resend API key (`<RESEND_API_KEY>.`) has full access. Create a scoped key:
1. Resend Dashboard → **API Keys → Create API Key**.
2. Set permission to **"Sending access"** only, scoped to your verified domain.
3. Update `RESEND_API_KEY` in your `.env` (and in Supabase Auth SMTP settings above)
   to use the new scoped key.
4. Delete the old full-access key.

---

## Step 5 — Customise email templates (optional but recommended)

In **Supabase Dashboard → Authentication → Email Templates**, customise the HTML
for:
- **Confirm signup** — add your logo and brand colours
- **Reset password** — add a clear call-to-action button
- **Magic link** — brand consistently

Using branded templates with your own domain improves deliverability further because
spam filters trust consistent, domain-matched branding.

---

## Summary checklist

- [ ] Resend domain verified (SPF + DKIM + DMARC DNS records added)
- [ ] Supabase Auth → custom SMTP enabled, pointing to `smtp.resend.com`
- [ ] Sender email uses your verified domain (`noreply@thesecuritywatch.com`)
- [ ] Redirect URLs updated in Supabase Auth settings
- [ ] Scoped Resend API key created and old key revoked
- [ ] Email templates branded with logo + colours

Once all five are done, delivery to inbox should be near 100%.

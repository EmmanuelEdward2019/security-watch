# Deployment runbook

Read [SECURITY.md](SECURITY.md) first if you are touching anything under
`supabase/`.

---

## Before you start: reconcile the schema

The repository's migrations had drifted from the live database — columns and a
whole table existed in production that appear in no migration file, and the app
read them. Until `supabase db diff` is clean, **no security fix in this
repository can be verified as actually applied**.

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db diff --schema public
```

If that reports differences, commit them as a numbered migration *before*
applying anything below. Then adopt the rule that schema changes only ever land
through migration files — never through the dashboard SQL editor.

---

## Deploying — and why it goes through CI

**Do not make the repository public to unblock a deployment.**

Vercel's Git integration verifies, on a private repository, that the commit
author has contributing access to the Vercel project. When it does not, the
build is refused:

> The deployment was blocked because the commit author did not have
> contributing access to the project on Vercel.

This repository has commits from two author emails —
`emmanueledward2016@gmail.com` (11) and `techfieldstechnologies@gmail.com` (20)
— and only the first is tied to the Vercel account `emmanueledward2016-8251`.
Making the repository public skips the check, which is why that appeared to fix
it. It is not a fix. This codebase contains the complete RLS design, every guard
trigger and all admin logic for a platform holding criminal case material.

`.github/workflows/deploy.yml` deploys through the Vercel CLI instead. A CLI
deploy authenticates with a scoped token, so there is no commit author in the
auth path and the check does not apply — whoever authors the commit, and with
the repository private.

### One-time setup

1. **Create a Vercel token** — Vercel → Account Settings → Tokens. Scope it to
   the `emmanueledward2016-8251` team, not to your whole account.

2. **Add three GitHub secrets** — repo → Settings → Secrets and variables →
   Actions:

   | Secret | Value |
   |---|---|
   | `VERCEL_TOKEN` | the token from step 1 |
   | `VERCEL_ORG_ID` | `team_1UIil7XDtSbH5Px7VUTtD3SR` |
   | `VERCEL_PROJECT_ID` | `prj_zxJBrQhmYFLPVgGAX9pNKTlXgLUd` |

   The two IDs are not secret — they are in `.vercel/project.json` — but the
   workflow reads them as secrets so a fork cannot target your project.

3. **Turn off the Vercel Git integration's auto-deploy** — Vercel → Project →
   Settings → Git → disconnect, or set Ignored Build Step to `exit 0`.
   Otherwise every push deploys twice: once (blocked) by the integration and
   once by CI.

Production then deploys only after typecheck, lint, build, dependency audit and
the migration sanity checks have all passed — which the Git integration could
never enforce. `workflow_dispatch` gives you a manual preview or production
deploy from the Actions tab.

### Optional: fix the underlying mismatch too

Independently worth doing, so the two identities stop diverging:

- On **GitHub**, add both addresses as verified emails on `EmmanuelEdward2019`,
  so commits from either are attributed to that account.
- Check your **global** git identity. It is currently
  `shop4me.market@gmail.com` — a different project. Any repository without a
  local override will author commits as that address and hit the same wall:

  ```bash
  git config --global user.email "emmanueledward2016@gmail.com"
  ```

---

## 0. Preflight — read-only

Run [`supabase/scripts/preflight.sql`](supabase/scripts/preflight.sql) in the SQL
editor first. It writes nothing and answers the questions that decide whether
these migrations will actually hold against *this* database.

The one that matters most is **section 1, leftover storage policies**. Postgres
combines permissive policies with `OR`, so a single surviving policy from the
original setup defeats the new restrictive ones completely. Migration 006 drops
the policies by the exact names used in `002_storage_buckets.sql` — but if the
production buckets were created through the Dashboard instead (which the old
README told you to do), the real policies have different names, those `DROP`s are
silent no-ops, and the permissive rules live on beside the new ones.

If section 1 lists anything outside the `avatars_* / evidence_* / …` naming, drop
it by name before continuing, or the storage hardening is cosmetic.

Also worth acting on before you apply anything:

- **Section 3** lists accounts holding a privileged role that matches their own
  signup metadata — i.e. accounts that could have granted themselves that role
  while the old trigger was live. Check every one against people you actually
  onboarded.
- **Section 4** flags duplicate `provider_reference` values, which would make the
  new unique index in 004 fail, and shows exactly which duplicate ratings 004
  will delete.
- **Section 5** counts payments marked `completed` by the old client-side write.
  None were ever verified against Paystack; the platform cannot tell you which
  are real, so reconcile them against the Paystack dashboard.
- **Section 7** counts file references still stored as full URLs. Evidence and
  chat files recover automatically at read time, but **media reports do not** —
  the storage policy matches `media_reports.file_url` against the object name
  exactly, so any row still holding a URL stays unreadable after publication.
  Section 8 has the rewrite.

---

## 1. Apply the migrations, in order

### First: repair the migration history

`supabase db push` **will fail without this step.** The original schema was
applied by hand through the SQL editor, so `supabase_migrations.schema_migrations`
does not exist — the CLI believes nothing has ever been applied. A plain push
would try to run `000` through `008` and abort at `001`, whose
`CREATE TABLE public.profiles` has no `IF NOT EXISTS` and hits a table that is
already there.

Mark the already-applied migrations as such, without running them:

```bash
supabase migration repair --status applied 000 001 002 003
```

This is truthful — `000`–`003` really are in the database. Verified against
production: all 18 tables from `001` exist with RLS enabled, all 7 buckets and
all 18 storage policies from `002` are present under their original names, and
`security_service_requests` from `003` exists.

### Then push

```bash
supabase db push
```

| Migration | What it does |
|---|---|
| `004_security_hardening.sql` | Privilege guards, admin RPCs, signup role restriction, counterparty profile visibility, conversation RPCs, payment/audit/notification lockdown, score constraints, dashboard aggregates |
| `005_feature_completion.sql` | `investigators.is_available`, `account_deletion_requests`, `service_prices` (+ default catalogue), `investigation_reports`, `legal_documents`, `forensic_analyses`, `saved_properties`, `property_verification_requests`, `contact_messages`, `blog_posts`, ledger/earnings/activity functions |
| `006_storage_hardening.sql` | Path-scoped bucket policies, `legal-documents` bucket, admin read on evidence and KYC |
| `007_audit_trail.sql` | Audit triggers on every sensitive table, admin read API, security summary |
| `008_content_seed.sql` | Moves the previously hardcoded blog content into `blog_posts` |
| `009_grant_tightening.sql` | Re-revokes `anon` EXECUTE that Supabase's event trigger re-granted after `004`; removes write grants on `payments`, and DELETE on `evidence` and `performance_scores` |
| `010_internal_function_grants.sql` | Revokes client EXECUTE on trigger functions (silences advisor false positives — PostgREST cannot call a `trigger`-returning function anyway) |
| `011_restore_policy_predicate_grants.sql` | **Fixes a regression in `010`.** RLS policy predicates need the *caller's* EXECUTE; revoking them broke every authenticated read. See [SECURITY.md](SECURITY.md#two-traps-in-the-grant-layer) |

Two things bit during the real run, both now handled in the files above:

- **`uuid_generate_v4()` fails under `db push`.** Supabase installs `uuid-ossp`
  into the `extensions` schema, which is not on the `search_path` the CLI uses —
  so it resolves in the SQL editor but not in a migration. `005` uses
  `gen_random_uuid()` (core Postgres since 13) instead. Use that in anything new.
- **A derived table takes its column names from the first branch's expressions.**
  `my_activity()` had an unaliased `UNION ALL` subquery, so `ORDER BY occurred_at`
  referenced a name that did not exist. Alias every column in a `UNION` subquery.

`004` emits a `WARNING` listing accounts whose privileged role matches their
signup metadata and was never admin-confirmed. **Read it.** Those are the
accounts that could have self-assigned a role before the fix:

```sql
SELECT user_id, email, role, created_at
FROM public.profiles
WHERE role IN ('admin','investigator','lawyer','medical_expert')
ORDER BY created_at;
```

Anything you do not recognise, demote:

```sql
SELECT public.admin_set_user_role('<user_id>', 'complainant');
```

---

## 2. Rotate the credentials

The Resend API key was sitting in `.env`. Even though Vite never bundled it (no
`VITE_` prefix), rotate it — a production credential in a frontend env file is
one careless rename from disclosure.

1. Generate a new key in Resend, revoke the old one.
2. Remove the line from `.env` entirely.
3. Set the server-side secrets:

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxx \
  RESEND_FROM_EMAIL="The Security Watch <noreply@thesecuritywatch.com>" \
  SEND_EMAIL_HOOK_SECRET=v1,whsec_xxxxxxxx \
  PAYSTACK_SECRET_KEY=sk_live_xxxxxxxx \
  ALLOWED_ORIGINS=https://thesecuritywatch.com,https://www.thesecuritywatch.com \
  SITE_URL=https://thesecuritywatch.com
```

`RESEND_FROM_EMAIL` must be a domain verified in Resend. The
`onboarding@resend.dev` sender only delivers to the Resend account owner, so
production email silently fails for everyone else.

---

## 3. Deploy the functions

`verify_jwt` comes from `supabase/config.toml`, so a plain deploy is correct for
most of them. The three that authenticate themselves another way need the flag
explicitly if you deploy them individually:

```bash
# Caller-authorized (JWT required)
supabase functions deploy send-notification-email
supabase functions deploy payments-initialize
supabase functions deploy match-investigator
supabase functions deploy generate-report
supabase functions deploy admin-process-deletion

# Self-authenticating — signature verified inside the function
supabase functions deploy auth-send-email    --no-verify-jwt
supabase functions deploy payments-webhook   --no-verify-jwt
supabase functions deploy public-enquiry     --no-verify-jwt
```

---

## 4. Wire the webhooks

**Paystack** → Dashboard → Settings → API Keys & Webhooks → Webhook URL:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/payments-webhook
```

This is the only thing that can mark a payment complete. If it is not configured,
every payment stays `pending` forever — which is the correct failure direction,
but nobody gets what they paid for.

**Supabase Auth** → Authentication → Hooks → Send Email → HTTPS:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email
```

Copy the signing secret into `SEND_EMAIL_HOOK_SECRET`. If auth emails stop
arriving after this change, that mismatch is the first thing to check — the
function now rejects unsigned requests instead of sending anyway.

---

## 5. Create the first administrator

There is no self-service path to `admin` any more. Sign up normally, then:

```sql
UPDATE public.profiles
SET role = 'admin', kyc_status = 'approved', role_confirmed_at = now()
WHERE email = 'you@example.com';
```

This direct UPDATE works only from the SQL editor, which runs as the table owner
and is not subject to the guard trigger. Every subsequent role change should go
through the admin UI so it is audited.

---

## 6. Verify the hardening actually took

Run these as a **non-admin** signed-in user. Every one must fail or be reverted.

```js
// 1. Signup must not grant admin
await supabase.auth.signUp({
  email: 'probe@example.com', password: 'Str0ng-Passw0rd!',
  options: { data: { role: 'admin' } },
});
// then: SELECT role FROM profiles WHERE email='probe@example.com'  →  'complainant'

// 2. Self-promotion must be reverted and logged
await supabase.from('profiles').update({ role: 'admin' }).eq('user_id', myId);
// role unchanged; a guard_violation appears in the audit trail

// 3. Conversation gate-crashing must fail
await supabase.from('conversation_participants')
  .insert({ conversation_id: someOtherThreadId, user_id: myId });
// → permission denied (no insert policy exists)

// 4. Self-verification must be reverted
await supabase.from('investigators')
  .update({ verification_status: 'approved', rating: 5 }).eq('user_id', myId);
// unchanged; guard_violation logged

// 5. Payment forgery must fail
await supabase.from('payments').insert({
  payer_id: myId, amount: 1, currency: 'NGN',
  provider: 'paystack', status: 'completed',
});
// → permission denied
```

Then, as an admin, confirm the trail recorded the attempts:

```sql
SELECT created_at, action, resource_type, details, severity
FROM public.audit_logs
WHERE action = 'guard_violation'
ORDER BY created_at DESC;
```

Also confirm the email hook is closed:

```bash
# Unsigned request — must return 200 and send nothing
curl -s -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/auth-send-email \
  -H 'Content-Type: application/json' \
  -d '{"user":{"email":"attacker@example.com"},"email_data":{"email_action_type":"signup"}}'
```

Check the function logs for `REJECTED — webhook signature invalid or missing`.
No email should arrive.

---

## 7. Deploy the frontend

```bash
npm ci
npm run build
vercel --prod
```

Security headers, including the CSP, come from `vercel.json`. After deploying,
confirm they are live:

```bash
curl -sI https://thesecuritywatch.com | grep -iE 'content-security-policy|strict-transport|x-frame'
```

The CSP allowlists `js.paystack.co`, `checkout.paystack.com` and the Google Fonts
hosts. If you add a third-party script, it must be added there or it will be
blocked — that is the point.

---

## Operational checks worth setting up

Not configured by this repository, but the next things to add:

- **Error tracking** (Sentry) on the frontend and the edge functions. The stores
  currently report failures to the user but there is no aggregation.
- **Alert on `guard_violation`** — the highest-signal security event the platform
  produces. A single one deserves a look.
- **Alert on `payment_amount_mismatch`** — indicates checkout tampering.
- **Alert on failed webhook deliveries** in the Paystack dashboard. A silently
  broken webhook means paid users get nothing.
- **Uptime monitoring** on `/` and on the payments-webhook endpoint.

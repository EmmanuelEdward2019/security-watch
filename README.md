# The Security Watch

**...your concern**

A Nigerian civic-tech platform combining three systems: **Investigative
Services**, **Institutional Transparency & Media**, and **Property Verification
& Real Estate**, plus **Fountain Source** — a public enquiry funnel for corporate
security contracts.

- [SECURITY.md](SECURITY.md) — the authorization model. Read this before changing anything under `supabase/`.
- [DEPLOYMENT.md](DEPLOYMENT.md) — migrations, secrets, webhooks, and how to verify the hardening took.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| State | Zustand |
| Backend | Supabase (PostgreSQL + RLS, Auth, Storage, Realtime, Edge Functions) |
| Payments | Paystack — server-initialized, webhook-verified |
| Email | Resend, via Edge Functions |
| Build | Vite 8 |

There is no application server. The browser talks directly to Postgres, so
**authorization lives in the database** — RLS policies, column guard triggers,
and `SECURITY DEFINER` functions. The client-side route table in
`src/lib/rbac.ts` hides navigation; it is not a security boundary.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project
- A Paystack account (for payments)
- A Resend account with a verified sending domain (for email)

### 1. Install and configure

```bash
npm install
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SITE_URL`. Only
`VITE_`-prefixed variables reach the browser — never put a secret in `.env`.
Server-side secrets go in Supabase Edge Function secrets; see
[DEPLOYMENT.md](DEPLOYMENT.md#2-rotate-the-credentials).

### 2. Set up the database

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Migrations must be applied in order. `004` prints a warning listing any account
holding a privileged role that was never admin-confirmed — read it.

### 3. Deploy the Edge Functions

```bash
supabase functions deploy send-notification-email
supabase functions deploy payments-initialize
supabase functions deploy match-investigator
supabase functions deploy generate-report
supabase functions deploy admin-process-deletion

# These authenticate themselves by signature rather than by JWT
supabase functions deploy auth-send-email  --no-verify-jwt
supabase functions deploy payments-webhook --no-verify-jwt
supabase functions deploy public-enquiry   --no-verify-jwt
```

Storage buckets and their policies are created by `006_storage_hardening.sql` —
do not create them by hand in the dashboard, or the path-scoped policies will not
match.

### 4. Run

```bash
npm run dev     # http://localhost:5173
npm run build   # production build
npm run lint    # ESLint
```

---

## Project structure

```
├── src/
│   ├── components/
│   │   ├── ui/           Button, Card, Modal, DataTable, FileUpload, …
│   │   ├── layout/       Sidebar, Header, DashboardLayout
│   │   ├── auth/         ProtectedRoute
│   │   ├── cases/        CaseCard, EvidenceTimeline, CaseStatusTracker
│   │   ├── property/     PropertyCard
│   │   ├── media/        ScoreCard, InstitutionCard
│   │   ├── messaging/    ConversationList, ChatWindow, MessageInput
│   │   └── payments/     PaymentModal
│   ├── pages/            Route components, lazily imported by the router
│   ├── stores/           Zustand stores — read/write through RPCs where privileged
│   ├── services/         paymentService, matchingService, auditService,
│   │                     caseWorkService, adminService, propertyExtrasService
│   ├── lib/              supabase client + storage helpers, email
│   ├── types/            Shared TypeScript definitions
│   └── router.tsx        Route manifest with lazy imports
└── supabase/
    ├── migrations/       001–003 original schema · 004–008 hardening & features
    ├── functions/        Edge Functions
    └── seed/             Institution seed data
```

---

## User roles

Roles marked **verified** are not self-service: registering for one records a
request, and an administrator grants it after reviewing the applicant's KYC
documents and guarantors. This is deliberate — those roles can see other people's
case files.

| Role | Granted | Access |
|------|---------|--------|
| Complainant | on signup | File cases, upload evidence, track progress |
| Witness/Informant | on signup | Submit witness reports |
| Landlord | on signup | List properties, manage tenants and enquiries |
| Tenant/Buyer | on signup | Browse, save, request verification |
| Media Agent | on signup | Field recording, institution reports and ratings |
| Investigator | **verified** | Receive assignments, file investigation reports |
| Lawyer | **verified** | File legal documents against a case |
| Medical/Forensic Expert | **verified** | Record forensic analyses on evidence |
| Administrator | by an existing admin | Full oversight, approvals, audit trail |

---

## Core modules

### 1. Investigative services

Case filing across eleven categories with urgency and geolocation. Evidence is
hashed with SHA-256 at upload and **re-verified on every read** — a hash nobody
checks proves nothing. The chain-of-custody log is written by the database from
the authenticated identity, not by the client, and grows only through
`append_custody_entry`. A filed exhibit can never be replaced: the evidence
bucket has no update policy.

Cases move through seven stages under a role-aware state machine: an assigned
professional may advance their own stage, a complainant may withdraw, only an
admin may move a case anywhere. Assignment is admin-confirmed and re-validates
that the assignee holds the role and has passed verification — the matching
engine ranks candidates but does not decide.

Investigators file **investigation reports**; lawyers file **legal documents**;
forensic experts record **analyses** against a specific exhibit.

### 2. Institutional transparency & media

Media agents record video, audio and photos in the field with GPS and timestamp
stamped onto the report and a SHA-256 recorded. Everything enters as
`pending_review`: publication is an administrator's decision, which is what keeps
unreviewed allegations about named police commands and hospitals off the public
archive.

Citizens rate institutions on five measures. Ratings are **one per person per
institution**, and the overall score is a generated column computed by Postgres —
so a published ranking cannot be stuffed or forged.

### 3. Property verification & real estate

Listings with image galleries and title documents. A tenant requests independent
verification; the request enters the admin review queue only once the fee
settles. The **verified badge is granted by an administrator** and is not writable
by the owner — that is the whole value of it.

### 4. Secure communication

Realtime 1:1 and case-group messaging. Membership is granted only by an RPC that
verifies the caller belongs in the thread. Attachments live in a private bucket
scoped to the conversation and are read through short-lived signed URLs.

### 5. Payments

Paystack, server-side. The client names a *purpose*; the amount comes from the
`service_prices` catalogue on the server. Checkout happens on Paystack's hosted
page, and a payment is marked complete only by a webhook that verifies the HMAC
signature, re-fetches the transaction from Paystack, and checks the amount
matches what was priced. The client cannot influence the amount, the status or
the reference.

Stripe is **not** implemented.

---

## Security

Fully documented in [SECURITY.md](SECURITY.md). In summary:

- **RLS on every table**, with column-level guards on any field that encodes
  trust — a role, a verification status, a published flag, a money amount.
- **Privileged writes go through `SECURITY DEFINER` RPCs** that check the caller.
  Direct writes to protected columns are reverted and logged as
  `guard_violation` at critical severity.
- **Signup cannot grant a privileged role.**
- **Storage is path-scoped**; private buckets are read through signed URLs and
  never accept an overwrite.
- **Audit trail written by database triggers**, not the application. Client
  INSERT on `audit_logs` is revoked, so entries can be neither forged nor
  suppressed.
- **Edge functions authorize the caller** before touching the service-role key. A
  bare anon key is not authorization — it ships in the browser bundle.
- **Payments are provider-verified**, never self-declared.
- **Security headers including a CSP** are set in `vercel.json`.

Report a vulnerability to `security@thesecuritywatch.com` — please not a public
issue.

---

## Known limitations

Stated plainly rather than left to be discovered:

- **No automated test suite.** The highest-value thing to add is a suite that
  asserts a non-admin cannot escalate — see the manual probes in
  [DEPLOYMENT.md](DEPLOYMENT.md#6-verify-the-hardening-actually-took).
- **No error tracking or alerting.** Sentry on the frontend and edge functions,
  plus an alert on `guard_violation`, are the next operational step.
- **Messages are not end-to-end encrypted.** `is_encrypted` exists on the table
  and is always `false`. Access is controlled by RLS, which protects against
  other users but not against a database compromise. Envelope encryption for
  witness channels specifically is a worthwhile addition.
- **`react-hooks/set-state-in-effect` is set to warn**, not error. Every
  occurrence is a `useCallback` loader that opens with `setLoading(true)` — one
  extra render pass, idiomatic, and not worth restructuring twenty loaders to
  satisfy.

---

## License

Proprietary — The Security Watch © 2026

> # ⚠️ SUPERSEDED — DO NOT BUILD FROM THIS FILE
>
> This describes a backend that no longer exists. Between this document and
> now, the platform was security-hardened across migrations 004–011: roles
> can no longer be self-granted, case status and payments are server-mediated,
> private buckets require signed URLs, and several patterns below now fail —
> some of them **silently**, by design.
>
> Use **[MOBILE_API.md](MOBILE_API.md)** instead. It was verified against the live
> database on 30 July 2026.
>
> Kept only for historical reference.

---

# The Security Watch — Mobile App API Documentation

**Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
**API style:** PostgREST (auto-generated from schema) + Supabase JS SDK
**Status as of:** 2026-05-13
**Web app live at:** https://thesecuritywatch.com

The mobile app shares 100% of the backend, database schema, RLS policies, storage buckets, edge functions, and auth flow with the web app. No new endpoints are needed — only a React Native client implementation.

---

## 1. Connection & Environment

### 1.1 Supabase project credentials

| Key | Value | Purpose |
|---|---|---|
| `SUPABASE_URL` | `https://pqjwzidrgkskpjihxvxa.supabase.co` | Project base URL |
| `SUPABASE_ANON_KEY` | (anon JWT, identical to web `VITE_SUPABASE_ANON_KEY`) | Public client key |
| `PAYSTACK_PUBLIC_KEY` | `pk_test_…` (live key in Vercel env) | Paystack inline payments |

### 1.2 Required mobile env variables

```
EXPO_PUBLIC_SUPABASE_URL=https://pqjwzidrgkskpjihxvxa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=...
EXPO_PUBLIC_SITE_URL=https://thesecuritywatch.com
```

### 1.3 SDK initialization (React Native / Expo)

```ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,   // RN has no URL session
    },
    realtime: { params: { eventsPerSecond: 10 } },
  }
)
```

---

## 2. Authentication

All auth flows are handled by **Supabase Auth**. Sessions are JWT-based with auto-refresh. The Edge Function `auth-send-email` intercepts every auth email and sends an **8-digit OTP** via Resend (no magic links, no confirmation buttons — only an 8-digit code).

### 2.1 Sign up

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name, role },         // role from UserRole union
    // emailRedirectTo not used — we verify via OTP instead
  },
})
```

**Flow:**
1. Call `signUp` → Supabase generates 8-digit OTP, hook emails it to the user.
2. Navigate to OTP entry screen with email + `mode=signup`.
3. Verify with `supabase.auth.verifyOtp({ email, token: code, type: 'signup' })`.
4. On success, fetch profile and route to role's home screen.
5. A trigger on `auth.users` auto-creates a row in `public.profiles` with the chosen role.

### 2.2 Sign in

```ts
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
```

### 2.3 Forgot password (OTP-based)

```ts
// Step 1 — request code
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false },
})

// Step 2 — verify code
await supabase.auth.verifyOtp({ email, token: code, type: 'email' })

// Step 3 — set new password (session now active)
await supabase.auth.updateUser({ password: newPassword })
```

### 2.4 Sign out

```ts
await supabase.auth.signOut()
```

### 2.5 Session restoration

```ts
const { data: { session } } = await supabase.auth.getSession()
supabase.auth.onAuthStateChange((_event, session) => { /* update state */ })
```

### 2.6 Two-factor authentication (TOTP)

```ts
const { data } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
// data.totp.qr_code is a data: URI — display to user
const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: data.id })
await supabase.auth.mfa.verify({
  factorId: data.id,
  challengeId: challenge.id,
  code: userEnteredCode,
})
// Later: supabase.auth.mfa.unenroll({ factorId })
```

### 2.7 Account deletion

Insert a row into `account_deletion_requests` then sign the user out:

```ts
await supabase.from('account_deletion_requests').insert({
  user_id: user.user_id,
  email: user.email,
  full_name: user.full_name,
  requested_at: new Date().toISOString(),
  status: 'pending',
})
await supabase.auth.signOut()
```

---

## 3. User Roles & RBAC

```ts
type UserRole =
  | 'complainant'
  | 'investigator'
  | 'lawyer'
  | 'medical_expert'
  | 'witness'
  | 'landlord'
  | 'tenant'
  | 'media_agent'
  | 'admin'
```

| Role | Description | Pays? | Earns? |
|---|---|---|---|
| `complainant` | Reports cases | ✓ | — |
| `investigator` | Field agent | — | ✓ |
| `lawyer` | Legal counsel | — | ✓ |
| `medical_expert` | Forensic / medical | — | ✓ |
| `witness` | Provides testimony | ✓ | — |
| `landlord` | Property owner | ✓ | — |
| `tenant` | Renter / buyer | ✓ | — |
| `media_agent` | Field journalist | — | ✓ |
| `admin` | Platform operator | — | — |

**RBAC source of truth:** `src/lib/rbac.ts` — defines `ROUTE_PERMISSIONS` mapping app routes to allowed roles. Mobile app should mirror this matrix when conditionally rendering navigation tabs.

**Role home screens:**
- All non-admin roles → `Dashboard`
- `admin` → `Admin Dashboard`

---

## 4. Database Schema (Tables)

All tables are in the `public` schema with **Row Level Security (RLS)** enabled. The mobile client must include the user's JWT in every request — handled automatically by the Supabase SDK.

### 4.1 `profiles`
Extended user data linked to `auth.users` by `user_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → auth.users(id) | unique |
| `email` | text | |
| `full_name` | text | |
| `phone` | text | nullable |
| `avatar_url` | text | nullable |
| `role` | text | one of `UserRole` |
| `kyc_status` | text | `pending` / `approved` / `rejected` |
| `bio` | text | nullable |
| `location` | text | nullable |
| `created_at`, `updated_at` | timestamptz | |

**RLS:** users can read/update own row; admins can read/update all.

### 4.2 `cases`
Investigation case records.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `title` | text | |
| `description` | text | |
| `category` | text | fraud / robbery / murder / assault / domestic_dispute / land_dispute / cybercrime / corruption / kidnapping / missing_person / other |
| `urgency` | text | low / medium / high / critical |
| `status` | text | submitted / under_review / assigned / investigating / legal_processing / completed / closed |
| `location` | text | |
| `latitude`, `longitude` | numeric | nullable |
| `complainant_id` | uuid FK → profiles(user_id) | |
| `assigned_investigator_id` | uuid | nullable |
| `assigned_lawyer_id` | uuid | nullable |
| `assigned_expert_id` | uuid | nullable |
| `created_at`, `updated_at` | timestamptz | |

**RLS:** participants and admins can read; only the complainant can insert; participants and admins can update.

### 4.3 `evidence`
Files attached to a case. Includes a `chain_of_custody` JSONB log.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `case_id` | uuid FK | cascade |
| `uploaded_by` | uuid FK → profiles(user_id) | |
| `file_url` | text | Supabase Storage public URL |
| `file_name` | text | |
| `file_type` | text | MIME |
| `file_size` | bigint | bytes |
| `file_hash` | text | SHA-256 (computed client-side) |
| `description` | text | |
| `chain_of_custody` | jsonb | array of `{timestamp, action, user_id, user_name, notes?}` |
| `created_at` | timestamptz | |

### 4.4 `investigators`
Verification & specialization data for investigator profiles.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK → profiles(user_id), unique |
| `specialization` | text[] |
| `experience_years` | int |
| `service_area` | text |
| `rating` | numeric (avg 0–5) |
| `total_cases` | int |
| `verification_status` | pending / approved / rejected |
| `id_document_url` | text |
| `service_records_url` | text |
| `admin_notes` | text |
| `created_at` | timestamptz |

### 4.5 `guarantors`
Per-investigator guarantor records (1 investigator → many guarantors).

| Column | Type |
|---|---|
| `id` | uuid PK |
| `investigator_id` | uuid FK |
| `full_name`, `email`, `phone`, `relationship` | text |
| `id_document_url` | text |
| `verification_status` | pending / approved / rejected |
| `verified_at` | timestamptz |
| `created_at` | timestamptz |

### 4.6 `conversations`, `conversation_participants`, `messages`
Realtime chat — supports direct and group, optionally case-scoped.

`conversations`:
- `id`, `case_id?`, `type` (`direct` | `group`), `title?`, `created_at`

`conversation_participants`:
- `id`, `conversation_id`, `user_id`, `joined_at`, unique(`conversation_id`, `user_id`)

`messages`:
- `id`, `conversation_id`, `sender_id`, `content`, `file_url?`, `file_name?`, `is_encrypted`, `read_at?`, `created_at`

### 4.7 `properties`
Property listings.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `owner_id` | uuid FK → profiles(user_id) |
| `title`, `description` | text |
| `property_type` | apartment / house / land / commercial / office |
| `price` | numeric |
| `currency` | text (default `NGN`) |
| `location`, `address` | text |
| `bedrooms`, `bathrooms` | int |
| `area_sqm` | numeric |
| `status` | unverified / pending / verified |
| `listing_type` | sale / rent |
| `is_active` | boolean |
| `images` | text[] (Supabase Storage URLs) |
| `features` | text[] |

### 4.8 `property_documents`, `property_requests`
- `property_documents` — title deeds, certificates etc. with `verified` flag.
- `property_requests` — inquiry from a tenant/buyer to a landlord, status: `pending` / `accepted` / `rejected`.

### 4.9 `institutions` & `media_reports` & `performance_scores`
Public-institution transparency module.

`institutions`: name, type (`police` / `school` / `hospital` / `market` / `government` / `court` / `other`), location, address, supervising_authority.

`media_reports`: institution_id, reporter_id, title, description, `media_type` (video/audio/photo/document), file_url, thumbnail_url, gps_*, `status` (pending_review / approved / rejected / published), tags, views.

`performance_scores`: institution_id, scorer_id, 5 sub-scores (1–5 each: punctuality, professionalism, cleanliness, integrity, service_delivery), overall_score, comment.

### 4.10 `payments`

| Column | Type |
|---|---|
| `id` | uuid PK |
| `payer_id` | uuid FK → profiles(user_id) |
| `case_id` | uuid? |
| `property_id` | uuid? |
| `amount` | numeric |
| `currency` | text (default `NGN`) |
| `provider` | stripe / paystack |
| `provider_reference` | text |
| `status` | pending / completed / failed / refunded |
| `description` | text |
| `created_at` | timestamptz |

### 4.11 `notifications`
In-app notifications. Used heavily across stores.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `title`, `message` | text |
| `type` | info / warning / success / error |
| `read` | boolean |
| `link` | text (deep-link path) |
| `created_at` | timestamptz |

### 4.12 `audit_logs`
Immutable audit trail (admins only).

### 4.13 `security_service_requests`
Public-form submissions from the "Fountain Source" pages (open to anonymous users).

### 4.14 `account_deletion_requests`
Soft-delete queue (admin processes).

---

## 5. Storage Buckets

| Bucket | Public | Size limit | MIME allowlist |
|---|---|---|---|
| `avatars` | ✓ | 5 MB | image/* |
| `evidence` | private | 50 MB | any |
| `property-images` | ✓ | 10 MB | image/* |
| `property-documents` | private | 20 MB | any |
| `media-reports` | private | 100 MB | any |
| `kyc-documents` | private | 10 MB | any |
| `chat-files` | private | 10 MB | any |

**Path convention:** `<userId>/<filename>` — RLS policies use `auth.uid()::text = (storage.foldername(name))[1]` for owner-only buckets.

### 5.1 Upload example (Expo)

```ts
import * as FileSystem from 'expo-file-system'

async function uploadEvidence(localUri: string, caseId: string) {
  const fileName = `${Date.now()}-${localUri.split('/').pop()}`
  const path = `${user.user_id}/${caseId}/${fileName}`
  const blob = await (await fetch(localUri)).blob()

  const { data, error } = await supabase.storage
    .from('evidence')
    .upload(path, blob, { upsert: true })
  if (error) throw error

  const { data: url } = supabase.storage.from('evidence').getPublicUrl(data.path)
  return url.publicUrl
}
```

---

## 6. Edge Functions (Server-Side)

Invoke with `supabase.functions.invoke('<name>', { body })`. All deployed at:
`https://pqjwzidrgkskpjihxvxa.supabase.co/functions/v1/<name>`

### 6.1 `send-notification-email`
Sends branded transactional emails via Resend.

**Request:**
```ts
await supabase.functions.invoke('send-notification-email', {
  body: {
    to: 'user@example.com',
    template: 'payment_received',  // see EmailTemplateId
    data: {
      recipientName, amount, currency, reference, caseTitle,
      caseId, status, messagePreview, conversationId,
      serviceType, companyName, dashboardUrl, actionUrl, extraNote,
    },
  },
})
```

**Template IDs** (full list in `src/lib/email.ts`):
- `payment_received`, `payment_failed`
- `case_assigned`, `case_status_update`
- `new_message`
- `verification_submitted`, `verification_approved`, `verification_rejected`
- `security_service_request_received`, `security_service_request_admin`
- `investigator_matched`, `report_ready`
- `institution_report_published`, `generic_notification`

### 6.2 `auth-send-email`
Internal — Supabase Auth → Send Email hook. Not invoked from clients. Generates the OTP-only email for sign-up confirmation, password reset, magic link, email change, MFA factor changes, etc. Logo loaded from `https://thesecuritywatch.com/assets/logo.png`.

### 6.3 `match-investigator`
Scores investigators against a case for assignment.

**Request:**
```ts
const { data } = await supabase.functions.invoke('match-investigator', {
  body: { case_id: '<uuid>', auto_assign: false },
})
// data: { matches: [{ investigator_id, score, rationale, ... }] }
```

Scoring: specialization (0-30) + location proximity (0-25) + experience (0-20) + rating (0-15) + availability (0-10) + urgency bonus.

### 6.4 `generate-report`
Generates an HTML performance report for an institution.

**Request:**
```ts
const { data } = await supabase.functions.invoke('generate-report', {
  body: { institution_id: '<uuid>', report_type: 'performance' },
})
// data: { html, summary }
```

---

## 7. Payments — Paystack Integration

The web app uses Paystack's Inline JS SDK. **Mobile must use Paystack's WebView checkout or Paystack mobile SDK** since Inline JS does not run in RN.

### 7.1 Recommended approach (WebView)

```ts
import { Paystack } from 'react-native-paystack-webview'

<Paystack
  paystackKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY!}
  amount={amountNGN}              // in naira (not kobo) — lib converts
  billingEmail={user.email}
  currency="NGN"
  refNumber={generateRef()}
  onCancel={(e) => {/* user cancelled */}}
  onSuccess={async (res) => {
    await supabase.from('payments').insert({
      payer_id: user.user_id,
      case_id, property_id,
      amount: amountNGN,
      currency: 'NGN',
      provider: 'paystack',
      provider_reference: res.transactionRef.reference,
      status: 'completed',
      description,
    })
    await sendTemplatedEmail(user.email, 'payment_received', { /* ... */ })
  }}
  autoStart={true}
/>
```

### 7.2 Payment flow rules
- **Payers:** complainant, witness, landlord, tenant — they have access to `payments` and `payments/history`.
- **Payees:** investigator, lawyer, medical_expert, media_agent — they have an `earnings` view that aggregates payments tied to their assigned cases.
- **Admin:** has a `payments-monitoring` view (read-only oversight).

### 7.3 Earnings query (for investigator/lawyer)

```ts
// 1) Get assigned case IDs
const { data: cases } = await supabase
  .from('cases')
  .select('id')
  .eq(role === 'lawyer' ? 'assigned_lawyer_id' : 'assigned_investigator_id', user.user_id)

// 2) Get payments for those cases
const { data: payments } = await supabase
  .from('payments')
  .select('*')
  .in('case_id', cases.map(c => c.id))
  .eq('status', 'completed')
```

---

## 8. Realtime (Supabase Channels)

Used for live chat and case updates. Subscribe per-conversation:

```ts
const channel = supabase
  .channel(`conversation:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    setMessages((prev) => [...prev, payload.new as Message])
  })
  .subscribe()

return () => { supabase.removeChannel(channel) }
```

Notifications can be similarly subscribed for badge updates:

```ts
supabase
  .channel(`notifications:${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`,
  }, (payload) => { /* badge++ */ })
  .subscribe()
```

---

## 9. Common Query Patterns

### 9.1 List cases (with relations)

```ts
const { data } = await supabase
  .from('cases')
  .select('*, complainant:profiles!complainant_id(*), investigator:profiles!assigned_investigator_id(*)')
  .order('created_at', { ascending: false })
```

### 9.2 Single case + evidence

```ts
const { data: caseData } = await supabase
  .from('cases').select('*').eq('id', id).single()

const { data: evidence } = await supabase
  .from('evidence').select('*').eq('case_id', id).order('created_at')
```

### 9.3 Properties (public listing)

```ts
const { data } = await supabase
  .from('properties')
  .select('*, owner:profiles!owner_id(full_name, avatar_url)')
  .eq('is_active', true)
  .order('created_at', { ascending: false })
```

### 9.4 Unread notifications count

```ts
const { count } = await supabase
  .from('notifications')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('read', false)
```

### 9.5 Mark notification read

```ts
await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
```

---

## 10. Error Handling Conventions

Every `supabase.from(...)...` call returns `{ data, error }`. Common error codes:

| Code | Meaning | Handle |
|---|---|---|
| `PGRST116` | Single() returned no rows | Show empty state |
| `42501` | RLS policy violation | Show "not authorized" |
| `23505` | Unique constraint violation | Show "already exists" |
| `email_exists` | Auth signup conflict | Suggest sign-in |
| `invalid_credentials` | Wrong password | Show generic message |
| `Token has expired or is invalid` | Bad OTP | Allow resend |

Wrap all SDK calls in try/catch + toast for user-facing errors.

---

## 11. Deep Links

The mobile app should register the URL scheme `securitywatch://` and handle these routes (mirror web paths under `/app/*`):

| Web path | Mobile screen |
|---|---|
| `/app/dashboard` | `Dashboard` |
| `/app/cases` | `CasesList` |
| `/app/cases/new` | `CreateCase` |
| `/app/cases/:id` | `CaseDetail` |
| `/app/cases/assigned` | `AssignedCases` |
| `/app/property` | `PropertyBrowse` |
| `/app/property/:id` | `PropertyDetail` |
| `/app/messages` | `MessageInbox` |
| `/app/messages/:conversationId` | `Chat` |
| `/app/notifications` | `Notifications` |
| `/app/profile` | `Profile` |
| `/app/settings` | `Settings` |
| `/app/payments` | `Payments` |
| `/app/earnings` | `Earnings` |

Notifications carry a `link` field that should be parsed into an in-app navigation action.

---

## 12. Push Notifications

The current schema only stores **in-app** notifications. For mobile push:

1. Add an `expo_push_token` text column to `profiles`.
2. Register the device with `expo-notifications` on login; upsert the token.
3. Create a new edge function `send-push-notification` (Expo Push API) and call it from existing places that insert into `notifications` (e.g. `caseStore.assignInvestigator`, `paymentStore.createPayment`).
4. Tap-handler reads `data.link` from the notification payload and routes accordingly.

---

## 13. Reference — Web App Source Files Mobile Devs Should Skim

| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | SDK setup, storage buckets, upload helper, SHA-256 hash |
| `src/lib/rbac.ts` | Role → route matrix |
| `src/lib/email.ts` | Templated email helper |
| `src/types/index.ts` | All TS interfaces — copy verbatim into mobile project |
| `src/stores/*Store.ts` | Zustand stores — mirror logic in mobile (TanStack Query or Zustand) |
| `src/pages/auth/VerifyOtpPage.tsx` | 8-digit OTP entry pattern |
| `supabase/migrations/*.sql` | Authoritative schema |
| `supabase/functions/*` | All server logic |

---

## 14. API Versioning & Backwards Compatibility

The mobile and web apps run against the **same Supabase project** with no API versioning layer. Schema changes are made via migrations in `supabase/migrations/`. To avoid breaking mobile builds in the wild:

- **Never drop or rename columns** — add new ones and mark old ones `deprecated_*` if needed.
- **Never tighten an RLS policy** without a feature-flag fallback.
- **New required fields** must have a DB default value.
- **New tables** are safe to add at any time.
- **New edge functions** are safe to add at any time.

For breaking changes, run them behind a `mobile_min_version` profile flag and force-upgrade users on app start.

# The Security Watch — Mobile API Reference

**Version 2.0 · Verified against production `pqjwzidrgkskpjihxvxa` on 30 July 2026**

This replaces `MOBILE_APP_API_DOCUMENTATION.md`, which described a backend that
no longer exists. Every table, column, enum value, RPC signature and grant below
was read out of the live database, not transcribed from the migration files.

---

## 0. Read this first — what changed, and why your old code will break

Between the previous document and this one the backend was security-hardened
across eight migrations (`004`–`011`). Several patterns the old app relied on are
now **impossible by design**. If you port the old React Native code as-is, these
are the things that will fail, mostly *silently*.

| What the old app did | What happens now | Do this instead |
|---|---|---|
| `signUp({ data: { role: 'investigator' } })` and got that role | Always becomes `complainant`. Privileged roles are recorded in `requested_role` for admin review | Read `profile.role`, never assume the requested one was granted. Show a "pending verification" state |
| `UPDATE profiles SET role=…` | **Succeeds with no error and changes nothing.** Logged as a `guard_violation` at `critical` severity | Never write `role` or `kyc_status`. Admin-only, via `admin_set_user_role()` |
| `UPDATE cases SET status=…` | **Succeeds with no error and changes nothing** | `rpc('update_case_status', …)` |
| `INSERT INTO payments … status:'completed'` | Hard error `42501` — the grant is revoked | `functions.invoke('payments-initialize')`, then Paystack, then the webhook settles it |
| `INSERT INTO conversation_participants` | Hard error `42501` | `rpc('create_conversation', …)` |
| `INSERT INTO notifications` | Hard error `42501` | Server-side only. You can only read and mark read |
| `UPDATE investigators SET verification_status:'approved'` | Reverted silently, rating and total_cases pinned too | Admin-only via `admin_review_investigator()` |
| `UPDATE media_reports SET status:'published'` | Reverted silently | Admin-only via `admin_review_media_report()` |
| `UPDATE properties SET status:'verified'` | Reverted silently (`unverified → pending` is the one legal self-transition) | Admin-only via `admin_set_property_status()` |
| `getPublicUrl()` on evidence/media/chat/kyc | Returns a URL that 400s. Those buckets are private | `createSignedUrl()`. See §6 |
| Stored `file_url` as a full URL | Storage policies match on the **object path** | Store the path, sign on read |
| `insert(performance_scores).overall_score` | Column is `GENERATED ALWAYS` — the write is rejected | Send only the five 1–5 metrics |
| Called `send-notification-email` with `{ to, subject, html }` | `403`. Raw HTML and free-choice recipients are gone | `{ recipientUserId, template, data }` |
| Called `match-investigator` with the anon key | `401`. Admin JWT required, and it no longer auto-assigns | Admin-only; it returns *suggestions* |

**The silent ones are the dangerous ones.** A guard trigger reverts the write and
returns success, so `error` is `null` and your optimistic UI will show a change
that did not happen. Always re-read after a mutation on `profiles`, `cases`,
`investigators`, `media_reports` and `properties`, or use the RPC and trust its
thrown exception.

---

## 1. Connection

### 1.1 Project

```
Project ref   pqjwzidrgkskpjihxvxa
API URL       https://pqjwzidrgkskpjihxvxa.supabase.co
Region        West EU (Ireland)
Postgres      17.6
Web app       https://www.thesecuritywatch.com
```

### 1.2 Environment

```bash
# .env  — EXPO_PUBLIC_ vars are embedded in the binary. Anon key only.
EXPO_PUBLIC_SUPABASE_URL=https://pqjwzidrgkskpjihxvxa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
EXPO_PUBLIC_SITE_URL=https://www.thesecuritywatch.com
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxx   # public key only
```

> **Never ship the service-role key, the Paystack secret key, or the Resend key.**
> Anything embedded in an Expo binary is extractable. Every privileged operation
> already lives behind an edge function for exactly this reason.

### 1.3 Client

```ts
// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Must be false on native: there is no URL to parse a session out of.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  }
);

// Supabase does not know the app was backgrounded. Without this the access
// token silently expires while the app sleeps and every request 401s on resume.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

For sensitive deployments, back `storage` with `expo-secure-store` instead of
AsyncStorage — AsyncStorage is plain text on a rooted or jailbroken device, and
this app holds criminal case material. Note the 2048-byte SecureStore limit: chunk
the session or store only the refresh token.

---

## 2. Authentication

### 2.1 Sign up

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName, role: selectedRole },
    emailRedirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}/login`,
  },
});
```

`role` here is a **request, not a grant**. The database trigger decides:

| Requested | Granted immediately | Why |
|---|---|---|
| `complainant`, `witness`, `landlord`, `tenant`, `media_agent` | yes | These roles only ever reach their own records |
| `investigator`, `lawyer`, `medical_expert` | **no** — becomes `complainant`, stored in `requested_role` | These see other people's case files. An admin grants them after verification |
| `admin` | **no** — discarded entirely, not even recorded | Never self-service |

After signup, branch on the real profile:

```ts
const awaitingReview =
  profile.requested_role &&
  profile.requested_role !== profile.role &&
  profile.role_confirmed_at === null;
```

Show these users a "verification pending" screen with the KYC upload flow (§7.3),
not the investigator dashboard.

### 2.2 Sign in, OTP, reset

```ts
// password
await supabase.auth.signInWithPassword({ email, password });

// email OTP — 8 digits, matching the web app
await supabase.auth.verifyOtp({ email, token, type: 'email' });
await supabase.auth.resend({ type: 'signup', email });

// password reset — deep-links back into the app, see §12
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'securitywatch://reset-password',
});
```

### 2.3 Two-factor (TOTP)

Fully supported and already used on web. `enroll` returns an otpauth URI — render
it as a QR with `react-native-qrcode-svg`, and offer copy-to-clipboard for the
secret since the user is often enrolling on the same device.

```ts
const { data } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
// data.totp.qr_code (SVG string), data.totp.secret, data.totp.uri
const { data: c } = await supabase.auth.mfa.challenge({ factorId: data.id });
await supabase.auth.mfa.verify({ factorId: data.id, challengeId: c.id, code });
```

### 2.4 Account deletion

```ts
const { error } = await supabase.rpc('request_account_deletion', {
  p_reason: reason ?? null,
});
await supabase.auth.signOut();
```

Raises a request and notifies every admin. It does **not** delete anything
immediately — an admin approves it, and erasure is refused while the account is
on an open case. Tell the user that plainly; do not imply instant deletion.

---

## 3. Roles

Nine roles. `profiles.role` is the only source of truth — it cannot be set by the
client.

| Role | Module | Primary surfaces |
|---|---|---|
| `complainant` | Investigations | File cases, upload evidence, track status, chat |
| `investigator` | Investigations | Assigned cases, file reports, availability, earnings |
| `lawyer` | Investigations | Assigned cases, legal documents, earnings |
| `medical_expert` | Investigations | Assigned cases, forensic analyses, evidence verification |
| `witness` | Investigations | Cases they are named on |
| `landlord` | Property | Listings, tenant requests, transactions |
| `tenant` | Property | Browse, save, request, verify |
| `media_agent` | Transparency | Field recording, institutions, ratings, activity |
| `admin` | All | Everything, plus moderation and audit |

---

## 4. Schema — 27 tables

RLS is enabled on every one. The rules below are what the database enforces; your
UI should mirror them so users never see an action they cannot complete.

### 4.1 `profiles`

```
id uuid · user_id uuid (FK auth.users, UNIQUE) · email text · full_name text
phone text · avatar_url text · role text · kyc_status text
bio text · location text · requested_role text · role_confirmed_at timestamptz
created_at · updated_at
```

`role`: `complainant | investigator | lawyer | medical_expert | witness | landlord | tenant | media_agent | admin`
`kyc_status`: `pending | approved | rejected`

**Writable by the owner:** `full_name`, `phone`, `avatar_url`, `bio`, `location`.
Everything else is pinned by a trigger.

**Readable:** your own row; any row you share a case, conversation or property
enquiry with; everything if admin. This is why case cards can show the other
party's name — send `select('*, complainant:profiles!complainant_id(...)')` and
it resolves.

### 4.2 `cases`

```
id · title · description · category · urgency · status · location
latitude numeric · longitude numeric · complainant_id
assigned_investigator_id · assigned_lawyer_id · assigned_expert_id
created_at · updated_at
```

`category`: `fraud | robbery | murder | assault | domestic_dispute | land_dispute | cybercrime | corruption | kidnapping | missing_person | other`
`urgency`: `low | medium | high | critical`
`status`: `submitted | under_review | assigned | investigating | legal_processing | completed | closed`

**Insert:** `complainant_id` must be you. `status` and all three assignment
columns are forced to their defaults regardless of what you send.
**Update:** descriptive fields only. Status goes through `update_case_status()`;
assignment through `admin_assign_case()`.

Legal transitions enforced by the RPC:

| Actor | May move to |
|---|---|
| assigned investigator | `investigating`, `legal_processing`, `completed` |
| assigned lawyer | `legal_processing`, `completed` |
| assigned expert | `investigating`, `legal_processing` |
| complainant | `closed` (withdraw only) |
| admin | anything |

### 4.3 `evidence`

```
id · case_id · uploaded_by · file_url (OBJECT PATH) · file_name · file_type
file_size bigint · file_hash text · description · chain_of_custody jsonb
created_at
```

**Immutable once filed.** Only `chain_of_custody` grows, and only through
`append_custody_entry()`. No delete grant for anyone.

`file_url` holds a **storage object path**, not a URL — `{case_id}/{uuid}-{name}`.
The first segment is load-bearing: the storage policy grants read to case
participants based on it.

`chain_of_custody` is written by the database from your authenticated identity.
Do not construct it client-side; the first entry is created automatically on
insert.

`file_hash` is SHA-256 of the bytes, computed before upload. **Verify it on
download** (§6.3) — a hash nobody checks proves nothing, and this is the core
integrity claim of the whole product.

### 4.4 `investigators`

```
id · user_id (UNIQUE) · specialization text[] · experience_years int
service_area text · rating numeric · total_cases int · verification_status text
is_available boolean · id_document_url · service_records_url · admin_notes
created_at · updated_at
```

**Self-writable:** `specialization`, `service_area`, `experience_years`,
`is_available`.
**Pinned:** `verification_status`, `rating`, `total_cases`, `admin_notes`. On
insert they are forced to `pending` / `0` / `0` / `null`.

> `is_available` did not exist when the old doc was written — the availability
> screen was erroring in production. It exists now.

### 4.5 `guarantors`

```
id · investigator_id · full_name · email · phone · relationship
id_document_url · verification_status · verified_at · created_at
```

Insert your own; `verification_status` forced to `pending`.

### 4.6 Messaging — `conversations`, `conversation_participants`, `messages`

```
conversations              id · case_id · type (direct|group) · title · created_at
conversation_participants  id · conversation_id · user_id · joined_at
messages                   id · conversation_id · sender_id · content
                           file_url · file_name · is_encrypted · read_at · created_at
```

**Creating a thread is RPC-only.** Direct inserts into
`conversation_participants` are rejected — that hole previously let anyone read
any thread.

```ts
const { data: conversationId } = await supabase.rpc('create_conversation', {
  p_type: 'direct',
  p_participant_ids: [otherUserId],
  p_case_id: caseId ?? null,
  p_title: null,
});
```

Reuses an existing direct thread between the same pair rather than duplicating.
`sender_id` is overwritten server-side, so it cannot be spoofed. Message content
is immutable after send; only `read_at` may change.

`is_encrypted` exists but is always `false`. There is no E2E encryption — do not
tell users their messages are encrypted.

### 4.7 Property — `properties`, `property_documents`, `property_requests`

```
properties  id · owner_id · title · description · property_type · price numeric
            currency · location · address · bedrooms · bathrooms · area_sqm
            status · listing_type · is_active · images text[] · features text[]
```

`property_type`: `apartment | house | land | commercial | office`
`listing_type`: `sale | rent` · `status`: `unverified | pending | verified`

`status` is forced to `unverified` on insert. The owner may move
`unverified → pending` (submit for review); everything else is admin-only. The
verified badge is the module's entire value — treat it as authoritative in the UI
and never let an owner appear to set it.

`images` holds public CDN URLs (that bucket is public). `property_documents.file_url`
holds a **private object path** keyed by `{property_id}/`.

### 4.8 Transparency — `institutions`, `media_reports`, `performance_scores`

```
institutions        id · name · type · location · address · supervising_authority
media_reports       id · institution_id · reporter_id · title · description
                    media_type · file_url (PATH) · thumbnail_url
                    gps_latitude · gps_longitude · status · tags text[] · views
performance_scores  id · institution_id · scorer_id
                    punctuality · professionalism · cleanliness · integrity
                    service_delivery (all int 1–5)
                    overall_score numeric  ← GENERATED, do not send
                    comment · created_at
```

`institutions.type`: `police | school | hospital | market | government | court | other`
`media_reports.media_type`: `video | audio | photo | document`
`media_reports.status`: `pending_review | approved | rejected | published`

Media reports enter as `pending_review` always. A reporter may edit title,
description and tags **only while still in review**. Publication is admin-only.

`performance_scores` has `UNIQUE (institution_id, scorer_id)` — one rating per
person per institution. Use `upsert` with `onConflict: 'institution_id,scorer_id'`
so a re-rate updates rather than errors. `overall_score` is computed by Postgres.

`views` increments only via `rpc('increment_media_views')`, and only for published
reports.

### 4.9 Professional deliverables — new tables

```
investigation_reports  id · case_id · author_id · title · findings · recommendations
                       attachments jsonb · status · reviewer_notes · reviewed_by
                       reviewed_at · created_at · updated_at

legal_documents        id · case_id · author_id · document_type · title · description
                       file_path · file_name · file_size · file_hash
                       status · filed_at · created_at · updated_at

forensic_analyses      id · case_id · evidence_id · expert_id · analysis_type
                       methodology · findings · conclusion · confidence
                       attachments jsonb · status · created_at · updated_at
```

`investigation_reports.status`: `draft | submitted | accepted | revision_requested`
`legal_documents.document_type`: `affidavit | petition | court_filing | legal_opinion | witness_statement | subpoena | settlement | correspondence | other`
`legal_documents.status`: `draft | filed | served | archived`
`forensic_analyses.analysis_type`: `medical_examination | toxicology | dna | ballistics | digital_forensics | document_examination | pathology | psychological | other`
`forensic_analyses.confidence`: `low | moderate | high | conclusive`
`forensic_analyses.status`: `in_progress | completed | peer_review | finalised`

These three tables are what make the investigator, lawyer and medical-expert roles
functional — none of them existed before, which is why those roles had nothing to
do in the old app.

Insert requires being a case participant **and** holding the right role.
A submitted report's substance becomes read-only; a `finalised` analysis raises an
exception on any further edit.

`attachments` is `[{ path, name, size, type, hash }]` — object paths in the
`evidence` bucket, keyed by `{case_id}/`.

### 4.10 Payments

```
id · payer_id · case_id · property_id · amount numeric · currency
provider (stripe|paystack) · provider_reference (UNIQUE) · status
description · purpose · verified_at · provider_payload jsonb · created_at
```

`status`: `pending | completed | failed | refunded`

**Read-only for clients.** No insert, update or delete grant. See §8.

`purpose` is a key from `service_prices`. Stripe is in the enum but not
implemented — do not offer it.

### 4.11 `service_prices`

```
id · key (UNIQUE) · module · label · description · amount numeric(12,2)
currency · unit · is_active · sort_order · updated_by · created_at · updated_at
```

`module`: `investigation | property | media | security`

**Publicly readable** (anon included) when `is_active`. This is the price
catalogue the checkout function reads server-side, so what you display is exactly
what will be charged. Ten entries are seeded.

### 4.12 Remaining tables

```
saved_properties                id · user_id · property_id · notes · created_at
                                UNIQUE (user_id, property_id)
property_verification_requests  id · property_id · requester_id · reason · status
                                payment_id · admin_notes · reviewed_by · reviewed_at
notifications                   id · user_id · title · message · type · read · link
audit_logs                      id · user_id · action · resource_type · resource_id
                                details jsonb · severity · actor_role · ip_address
account_deletion_requests       id · user_id · email · full_name · reason · status
                                admin_notes · processed_by · processed_at
contact_messages                id · full_name · email · phone · subject · message
                                status · admin_notes
security_service_requests       id · full_name · email · phone · company_name
                                service_type · location · message · status
blog_posts                      id · slug · title · excerpt · body · cover_image_url
                                category · tags · author_name · read_minutes
                                status · published_at
```

`property_verification_requests.status`: `pending | in_review | verified | failed | cancelled`
— starts at `pending`, and the **payments webhook** moves it to `in_review` once
the fee settles. It cannot enter the queue without a confirmed payment.

`notifications`: read and mark-read only. Inserts are revoked.
`audit_logs`: admin read via RPC only. All client writes revoked.
`blog_posts`, `service_prices`: readable by anon when published/active.

---

## 5. RPCs

Call with `supabase.rpc(name, params)`. Every one raises a Postgres exception on
authorization failure, surfaced as `error.message` — show it, the messages are
written for users.

### 5.1 Available to any signed-in user

| RPC | Params | Returns | Notes |
|---|---|---|---|
| `create_conversation` | `p_type`, `p_participant_ids uuid[]`, `p_case_id?`, `p_title?` | `uuid` | Reuses existing direct threads |
| `add_conversation_participant` | `p_conversation_id`, `p_user_id` | `void` | Caller must already be in it |
| `update_case_status` | `p_case_id`, `p_status` | `void` | Enforces the transition table in §4.2 |
| `append_custody_entry` | `p_evidence_id`, `p_action`, `p_notes?` | `void` | Action: `viewed \| downloaded \| analysed \| transferred \| sealed` |
| `request_account_deletion` | `p_reason?` | `uuid` | Notifies all admins |
| `my_earnings` | — | table | Payments on cases you are assigned to |
| `my_activity` | `p_limit?` | table | Your reports, ratings and audited actions |
| `landlord_transactions` | — | table | Payments against your listings |

### 5.2 Public (anon included)

| RPC | Params | Returns |
|---|---|---|
| `institution_rankings` | — | `institution_id, name, type, location, avg_score, evaluations, published_reports` |
| `increment_media_views` | `p_report_id` | `void` |

### 5.3 Admin only

All raise `Administrators only` (or similar) for anyone else.

```
admin_platform_stats()                    → jsonb   dashboard counters
admin_monthly_trends(p_months)            → table   cases/users/properties/media/revenue by month
admin_security_summary()                  → jsonb   guard violations, unconfirmed roles, erasure queue
admin_audit_log(limit, offset, action, resource_type, severity, user_id) → table
admin_set_user_role(p_user_id, p_role)
admin_set_kyc_status(p_user_id, p_status)
admin_review_investigator(p_investigator_id, p_status, p_notes?)
admin_review_guarantor(p_guarantor_id, p_status)
admin_review_media_report(p_report_id, p_status, p_note?)
admin_set_property_status(p_property_id, p_status, p_verify_documents?)
admin_assign_case(p_case_id, p_user_id, p_slot)   -- slot: investigator|lawyer|expert
admin_resolve_verification_request(p_request_id, p_status, p_notes?)
```

`admin_assign_case` re-checks that the assignee holds the role **and** has
`kyc_status = 'approved'`, so it will refuse an unverified professional even if
the UI offered them.

`admin_set_user_role` refuses to demote the last remaining administrator.

### 5.4 Visible but not for you

Inspecting the schema will show ten more callable functions. They are **policy
predicates**, not app APIs — do not call them:

```
is_admin()                       is_case_participant(uuid)
is_conversation_participant(uuid) owns_property(uuid)
can_read_media_object(text)      storage_uuid_prefix(text)
shares_context_with(uuid)        current_role_name()
tsw_is_elevated()                rls_auto_enable()
```

They carry an `EXECUTE` grant for a non-obvious reason: when Postgres evaluates a
function inside an RLS policy expression, it checks the **caller's** privilege,
not the definer's. So `USING (… OR is_admin())` requires every role subject to
that policy to be able to execute `is_admin()`. Revoking them breaks every read
on the table — which is exactly what happened during hardening, and is why
migration `011` exists.

They answer only yes/no questions about the caller and leak nothing, but calling
them from the app is a round trip to learn something you already know. The one
legitimate exception is `shares_context_with`, which the
`send-notification-email` function calls as the caller to decide whether you may
email a given recipient.

---

## 6. Storage

### 6.1 Buckets

| Bucket | Public | Limit | Path layout | Who can read |
|---|---|---|---|---|
| `avatars` | **yes** | 5 MB | `{user_id}/{name}` | anyone |
| `property-images` | **yes** | 10 MB | `{user_id}/{uuid}-{name}` | anyone |
| `evidence` | no | 100 MB | `{case_id}/{uuid}-{name}` | case participants, admin |
| `property-documents` | no | 20 MB | `{property_id}/{uuid}-{name}` | property owner, admin |
| `media-reports` | no | 200 MB | `{user_id}/{uuid}-{name}` | uploader, admin, **anyone once published** |
| `kyc-documents` | no | 10 MB | `{user_id}/{uuid}-{name}` | owner, admin |
| `chat-files` | no | 10 MB | `{conversation_id}/{uuid}-{name}` | conversation participants, admin |
| `legal-documents` | no | 20 MB | `{author_id}/{uuid}-{name}` | author, case participants, admin |

**The first path segment is not cosmetic.** Storage policies key off it. Put a
file under the wrong prefix and the upload is rejected, or worse, becomes
unreadable by the people who need it.

`evidence` has **no UPDATE policy at all** and uploads must use `upsert: false`.
That is deliberate: it is what makes the recorded SHA-256 meaningful. A colliding
path fails loudly rather than silently replacing the bytes.

### 6.2 Upload

```ts
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

export function buildObjectPath(scopeId: string, fileName: string) {
  const safe = fileName.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-120);
  return `${scopeId}/${Crypto.randomUUID()}-${safe}`;
}

export async function uploadEvidence(caseId: string, asset: { uri: string; name: string; mimeType: string }) {
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // SHA-256 of the bytes, recorded on the row and re-checked on every download.
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  const path = buildObjectPath(caseId, asset.name);
  const bytes = decodeBase64ToUint8Array(base64); // use `base64-arraybuffer`

  const { error } = await supabase.storage
    .from('evidence')
    .upload(path, bytes, { contentType: asset.mimeType, upsert: false });
  if (error) throw error;

  await supabase.from('evidence').insert({
    case_id: caseId,
    uploaded_by: userId,
    file_url: path,          // the PATH, not a URL
    file_name: asset.name,
    file_type: asset.mimeType,
    file_size: bytes.byteLength,
    file_hash: hash,
  });
}
```

> Hash the **same bytes you upload**. Hashing the base64 string and uploading the
> decoded bytes gives a hash that never verifies. Pick one representation and be
> consistent with the web app, which hashes the raw `ArrayBuffer`.

### 6.3 Read, and verify

```ts
export async function signedUrl(bucket: string, path: string, seconds = 3600) {
  if (bucket === 'avatars' || bucket === 'property-images') {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await supabase.storage
    .from(bucket).createSignedUrl(path, seconds);
  if (error) return null;
  return data.signedUrl;
}
```

Signed URLs expire — do not cache them in persisted state. Sign on render, and
re-sign on a 403.

Downloading evidence should re-hash and compare, then log the access:

```ts
const { data: blob } = await supabase.storage.from('evidence').download(path);
const actual = await sha256(blob);
const intact = actual === row.file_hash;

await supabase.rpc('append_custody_entry', {
  p_evidence_id: row.id,
  p_action: 'downloaded',
  p_notes: intact ? 'Hash verified' : 'INTEGRITY WARNING: hash mismatch',
});
```

Surface a mismatch loudly. It means the file changed after filing.

### 6.4 Legacy rows

Some old rows still store full public URLs from before the fix. Handle both:

```ts
const isPath = !/^https?:\/\//i.test(row.file_url);
const url = isPath
  ? await signedUrl(bucket, row.file_url)
  : await signedUrl(bucket, extractPathFromLegacyUrl(row.file_url, bucket));
```

---

## 7. Edge functions

Base: `https://pqjwzidrgkskpjihxvxa.supabase.co/functions/v1/`
Call with `supabase.functions.invoke(name, { body })` — the SDK attaches the JWT.

Errors arrive as `FunctionsHttpError`; the useful message is in the response body:

```ts
async function fnError(error: unknown, fallback: string) {
  const ctx = (error as { context?: Response })?.context;
  if (ctx?.json) {
    try { const b = await ctx.json(); if (b?.error) return b.error as string; } catch {}
  }
  return (error as { message?: string })?.message ?? fallback;
}
```

| Function | Auth | Purpose |
|---|---|---|
| `payments-initialize` | user JWT | Prices server-side, returns Paystack checkout URL |
| `payments-webhook` | HMAC signature | **Only** writer that can complete a payment |
| `send-notification-email` | user JWT | Templated email, recipient by user id |
| `public-enquiry` | none | Contact + Fountain Source forms |
| `match-investigator` | admin JWT | Ranked suggestions. Does not assign |
| `generate-report` | user JWT | Institution performance dossier |
| `admin-process-deletion` | admin JWT | Executes an approved erasure |
| `auth-send-email` | webhook signature | Supabase Auth hook. Not callable by you |

### 7.1 `send-notification-email`

```ts
await supabase.functions.invoke('send-notification-email', {
  body: { recipientUserId, template: 'case_status_update', data: { caseTitle, status } },
});
```

Recipients are addressed **by user id**, never by email. The function resolves
the address server-side and refuses unless you share a case, conversation or
property enquiry with them. A raw `to` is admin-only.

Templates: `payment_received`, `payment_failed`, `case_assigned`,
`case_status_update`, `new_message`, `verification_submitted`,
`verification_approved`, `verification_rejected`,
`security_service_request_received`, `security_service_request_admin`,
`investigator_matched`, `report_ready`, `institution_report_published`,
`generic_notification`.

Treat delivery as best-effort; never block a user action on it.

### 7.2 `public-enquiry`

```ts
await supabase.functions.invoke('public-enquiry', {
  body: { kind: 'contact', fullName, email, phone, subject, message },
});
// or kind: 'security_service' with serviceType, companyName, location
```

Rate-limited to 5 per email per hour. Returns `429` past that.

---

## 8. Payments

The client can no longer create or modify a payment row. The flow:

```
1. rpc/fetch service_prices        → show the real price
2. invoke payments-initialize      → server prices it, creates `pending`, returns URL
3. open authorizationUrl           → Paystack hosted checkout
4. Paystack → payments-webhook     → HMAC verified, amount re-checked, marked completed
5. poll payments row               → reflect the settled status
```

```ts
const { data } = await supabase.functions.invoke('payments-initialize', {
  body: {
    purpose: 'property_verification',   // a service_prices.key
    propertyId,
    quantity: 1,
    callbackPath: '/app/payments',
  },
});
// → { paymentId, reference, amount, currency, label, authorizationUrl, accessCode }
```

**Never send an amount.** It is not accepted; the server prices from the
catalogue. The reference is server-generated too.

On mobile, open `authorizationUrl` in an in-app browser
(`expo-web-browser` → `openAuthSessionAsync`) with a `securitywatch://payment-return`
redirect. **Do not treat the browser closing as success** — that was the original
sin of the web version. Poll instead:

```ts
async function awaitSettlement(paymentId: string, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.from('payments')
      .select('*').eq('id', paymentId).maybeSingle();
    if (data && data.status !== 'pending') return data;
    await new Promise(r => setTimeout(r, 1500));
  }
  return null; // still settling — say so, do not claim failure
}
```

If polling times out, tell the user it is still confirming and will appear in
their history. Do not say the payment failed — the webhook may land seconds later.

---

## 9. Realtime

```ts
const channel = supabase
  .channel(`messages:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, ({ new: msg }) => append(msg))
  .subscribe();

return () => { void supabase.removeChannel(channel); };
```

Realtime respects RLS: you only receive rows you may read. Useful channels are
`messages` (per conversation), `notifications` (`user_id=eq.{me}`) and `cases`
(per case, for status changes).

Always remove the channel on unmount. On mobile also tear down on background and
re-subscribe on foreground, or you will leak sockets across app sessions.

---

## 10. Query patterns

```ts
// Cases — RLS already scopes to what you may see; no role filter needed
supabase.from('cases')
  .select('*, complainant:profiles!complainant_id(user_id,full_name,avatar_url), investigator:profiles!assigned_investigator_id(user_id,full_name,avatar_url)')
  .order('created_at', { ascending: false });

// Public marketplace — works unauthenticated
supabase.from('properties').select('*').eq('is_active', true)
  .order('status', { ascending: false })   // verified first
  .order('created_at', { ascending: false });

// Transparency archive — published only
supabase.from('media_reports')
  .select('*, institution:institutions(id,name,type,location)')
  .eq('status', 'published');

// Unread badge
supabase.from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId).eq('read', false);

// Save a property
supabase.from('saved_properties')
  .upsert({ user_id, property_id }, { onConflict: 'user_id,property_id' });

// Rate an institution — five metrics only
supabase.from('performance_scores').upsert({
  institution_id, scorer_id: userId,
  punctuality, professionalism, cleanliness, integrity, service_delivery, comment,
}, { onConflict: 'institution_id,scorer_id' });
```

---

## 11. Error handling

| Code | Meaning | Handle by |
|---|---|---|
| `42501` | Permission denied — RLS or a revoked grant | Hide the action. Reaching this is a UI bug |
| `PGRST116` | No rows from `.single()` | Use `.maybeSingle()` and branch on null |
| `23505` | Unique violation | Usually a duplicate save/rating — treat as success |
| `23503` | FK violation | Referenced row gone; refresh |
| `P0001` | `RAISE EXCEPTION` from an RPC | **Show `error.message` directly** — written for users |
| *(none)* | **Silent revert by a guard trigger** | Re-read after mutating a guarded table |

That last row has no error code because there is no error. Write a helper:

```ts
async function mutateAndConfirm<T>(mutate: () => Promise<T>, reread: () => Promise<{ ok: boolean }>) {
  await mutate();
  const { ok } = await reread();
  if (!ok) throw new Error('That change was not permitted.');
}
```

---

## 12. Deep links

Scheme `securitywatch://`, universal links on `www.thesecuritywatch.com`.

```
securitywatch://reset-password?token_hash=…&type=recovery
securitywatch://payment-return?reference=…
securitywatch://cases/{id}
securitywatch://media/{id}
securitywatch://property/{id}
securitywatch://messages/{conversationId}
```

`notifications.link` holds web paths (`/app/cases/{id}`). Map them to native
routes rather than opening a browser.

---

## 13. Push notifications

There is no push infrastructure yet — the web app polls. To add it:

1. Register the Expo push token on sign-in.
2. Create `push_tokens (user_id, token, platform, created_at)` with owner-scoped
   RLS. **Send the migration through the repo**, not the SQL editor — the
   migration history is now clean and should stay that way.
3. Add an edge function that reads tokens with the service-role key and posts to
   Expo's push API, called from the same places that already insert notifications.

Do not attempt to send pushes from the client; it would require exposing other
users' tokens.

---

## 14. Compliance notes

This app carries criminal case material and personal data on Nigerian citizens.

- **Evidence is immutable and hash-verified.** Never build an edit or delete path.
- **Erasure is a request, not an action** — and is refused while a case is open.
- **Everything privileged is audited** by database triggers. Assume every admin
  action in the app is on the record.
- **Do not claim encryption.** `is_encrypted` is always false.
- **Media is moderated before publication.** Never show a `pending_review` report
  in a public surface.

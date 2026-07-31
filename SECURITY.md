# Security model

This platform has no application server. The browser talks directly to Postgres
through Supabase, so **every authorization decision is enforced in the database**
— row-level security, column guards, and `SECURITY DEFINER` functions. The
client-side RBAC in `src/lib/rbac.ts` hides navigation; it is not a security
boundary and must never be treated as one.

Read this before changing anything under `supabase/`.

---

## The rule that matters most

**An RLS `UPDATE` policy controls which _row_ you may touch, not which
_columns_.** A policy written as:

```sql
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);
```

lets a user change *every column on their own row* — including `role`. Postgres
reuses `USING` as the check when `WITH CHECK` is omitted, so the only invariant
enforced is that the row still belongs to them.

This single mistake accounted for five separate privilege-escalation paths in the
original schema: self-assigned admin, self-approved investigator verification,
self-verified properties, self-published media reports, and self-reassigned
cases.

### How protected columns are enforced now

Supabase gives every signed-in user the same `authenticated` role, so a column
`REVOKE` would also block admins. Instead, protected columns are pinned by
`BEFORE UPDATE` triggers that only stand down inside a transaction flagged
privileged by one of our own `SECURITY DEFINER` functions:

```
tsw_elevate()      raises a transaction-local flag; NOT reachable over the API
tsw_is_elevated()  read by every guard trigger
```

A client cannot raise that flag: `tsw_elevate` has `EXECUTE` revoked from `anon`
and `authenticated`, and PostgREST only exposes named functions.

When a non-privileged caller tries to write a protected column, the write is
**silently reverted and logged** as a `guard_violation` at `critical` severity.
Reverting rather than raising keeps existing forms working (several PATCH a whole
object) while making escalation impossible — and the log entry gives you
detection. Watch `guardViolations24h` on the admin dashboard: a non-zero value
means someone is probing the API directly.

### Protected columns, and the RPC that owns each

| Table | Pinned columns | Change it through |
|---|---|---|
| `profiles` | `role`, `kyc_status`, `user_id`, `email` | `admin_set_user_role`, `admin_set_kyc_status` |
| `investigators` | `verification_status`, `rating`, `total_cases`, `admin_notes` | `admin_review_investigator` |
| `guarantors` | `verification_status`, `verified_at` | `admin_review_guarantor` |
| `properties` | `status`, `owner_id` | `admin_set_property_status` (owner may only submit `unverified → pending`) |
| `property_documents` | `verified` | `admin_set_property_status` |
| `media_reports` | `status`, `views`, `reporter_id`, `file_url` | `admin_review_media_report`, `increment_media_views` |
| `cases` | `status`, all `assigned_*`, `complainant_id` | `update_case_status`, `admin_assign_case` |
| `evidence` | everything after insert | `append_custody_entry` (custody log only) |
| `payments` | `status`, `amount`, `currency`, `verified_at` | `payments-webhook` edge function only |
| `performance_scores` | `overall_score` (generated column) | computed by Postgres |

---

## Signup does not grant privileged roles

`handle_new_user()` ignores any role in client metadata that would grant sight of
other people's case files. A registration for `investigator`, `lawyer` or
`medical_expert` is recorded in `profiles.requested_role` and the account starts
as `complainant`; an admin grants the real role through
`admin_review_investigator` after verification.

Self-service roles — `complainant`, `witness`, `landlord`, `tenant`,
`media_agent` — are granted immediately, because none of them can reach another
user's data.

`profiles.role_confirmed_at` distinguishes an admin-reviewed role from an
unreviewed one. `admin_security_summary()` counts unconfirmed privileged roles.

---

## Conversation membership

Membership is granted **only** by `create_conversation` and
`add_conversation_participant`, both of which verify the caller belongs there.

There is deliberately no self-insert policy on `conversation_participants`. The
original one checked `auth.uid() = user_id` but placed no constraint on
`conversation_id`, so any authenticated user could insert one row naming any
conversation and read every message in it — on a platform carrying witness and
informant communications about murder, kidnapping and corruption cases.

Every membership change is audited at `warning` severity.

---

## Storage

Object paths are load-bearing: the policies key access off the **first path
segment**. Use `buildObjectPath(scopeId, fileName)` and get the scope right.

| Bucket | Public | Path layout | Read access |
|---|---|---|---|
| `avatars` | yes | `{user_id}/…` | anyone |
| `property-images` | yes | `{user_id}/…` | anyone |
| `evidence` | no | `{case_id}/…` | case participants, admins |
| `property-documents` | no | `{property_id}/…` | property owner, admins |
| `chat-files` | no | `{conversation_id}/…` | conversation participants, admins |
| `media-reports` | no | `{user_id}/…` | uploader, admins, anyone once published |
| `kyc-documents` | no | `{user_id}/…` | owner, admins |
| `legal-documents` | no | `{author_id}/…` | author, case participants, admins |

Private buckets are read through short-lived signed URLs
(`getSignedUrl`), never `getPublicUrl`. **`upsert` is off everywhere** — the
evidence bucket previously accepted an overwrite at any path from any
authenticated user, which meant the bytes under a recorded SHA-256 could be
replaced without a trace.

The `evidence` bucket has **no UPDATE policy at all**, by design: a filed exhibit
can never be replaced. That is what makes the recorded hash meaningful, and
`downloadAndVerify()` re-checks it on every read.

---

## Payments

The client never writes a payment. The flow is:

1. `payments-initialize` (authenticated) prices the purpose from
   `service_prices`, creates a `pending` row, and calls Paystack with the
   **secret** key.
2. The payer completes checkout on Paystack's hosted page.
3. `payments-webhook` verifies the `x-paystack-signature` HMAC-SHA512 over the
   raw body, re-fetches the transaction from Paystack, checks the amount matches
   what we priced, and is the only writer that may set `completed`.

An amount mismatch is refused and logged at `critical` severity. Client `INSERT`
on `payments` is revoked and a trigger pins the status column, so neither the
policy nor the trigger alone is load-bearing.

**Never** add a client-side "verify payment" step. The original code had one that
returned `{ verified: true }` unconditionally.

---

## Edge functions

Every function that holds `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely, so
each one authorizes its caller **before** using that client:

1. Read the JWT from the `Authorization` header.
2. Resolve it with an **anon-key** client (`auth.getUser()`).
3. Assert role and resource ownership.
4. Only then touch the service-role client.

A bare anon key is not authorization: it ships in the browser bundle, and
`verify_jwt` only proves that *some* project token was presented.

`verify_jwt = false` is set for exactly three functions, each of which
authenticates itself another way and verifies a signature before doing any work:

| Function | Authenticated by |
|---|---|
| `auth-send-email` | Standard Webhooks signature (`SEND_EMAIL_HOOK_SECRET`) |
| `payments-webhook` | Paystack HMAC-SHA512 (`x-paystack-signature`) |
| `public-enquiry` | none — but rate-limited, fixed templates, recipient is the address just recorded |

**Do not add a fallback that proceeds when signature verification fails.**
`auth-send-email` had one: it caught the verification error and parsed the body
as plain JSON, which made the signature advisory and turned the endpoint into a
phishing relay sending branded mail from our own verified domain. An unverified
request now gets `200` and no email — 200 so a misconfigured secret on our side
cannot block a user's signup, and no email because that is what an
unauthenticated caller deserves.

### Email

`send-notification-email` accepts a **template id and a recipient user id**,
never raw HTML and never a raw address. It resolves the address server-side and
refuses to mail anyone the caller does not share a case, conversation or property
enquiry with — checked by asking the database, as the caller, via
`shares_context_with()`. A free-form `to` is admin-only.

---

## Audit trail

Written by database triggers (`007_audit_trail.sql`), not by the application.
Client `INSERT`, `UPDATE` and `DELETE` on `audit_logs` are revoked, so entries
can be neither forged nor suppressed by a client that chooses not to cooperate.

A client-side audit log is unenforceable by definition — the original one was
never even wired up.

Severities: `critical` (guard violations, evidence deletion, payment mismatch,
account erasure), `warning` (role and verification changes, evidence filings,
conversation access, pricing changes), `notice`, `info`.

---

## Two traps in the grant layer

Both of these were hit while applying the hardening, and both are easy to hit
again.

### 1. A policy predicate needs the *caller's* EXECUTE

`SECURITY DEFINER` decides what a function may do once it runs. It does **not**
grant permission to run it. When a function is invoked from inside an RLS policy
expression, Postgres checks the EXECUTE privilege of the calling role.

So a policy reading `USING (… OR is_admin())` requires **every role subject to
that policy** — including `anon` — to hold EXECUTE on `is_admin()`. Revoking it
does not harden anything; it breaks every read on the table:

```
ERROR 42501: permission denied for function is_admin
```

Migration `010` did exactly that, following the security advisor. `011` restored
the grants. The predicates are safe to expose: each answers a yes/no question
about the caller's own relationship to a row and leaks nothing about anyone else
— `is_admin()` called anonymously simply returns `false`.

`011` ends with a `DO` block that fails the migration if any predicate is
unreachable. Keep that pattern when adding a new one.

The advisor's underlying point is still fair — these should not be on the REST
surface at all. The correct fix is to move them to a schema PostgREST does not
expose, not to revoke EXECUTE. That is noted at the bottom of `011` and is worth
doing as its own migration.

### 2. Supabase re-grants EXECUTE on new functions

An event trigger auto-grants EXECUTE on new functions in `public` to `anon`,
`authenticated` and `service_role`, and it fires *after* the statements in your
migration. So a `REVOKE ALL … FROM PUBLIC` in the same file that created the
function does not survive.

Verified on production after `004`:

```
admin_set_user_role → anon=X/postgres | authenticated=X/postgres
```

It was not exploitable — every admin RPC opens with its own `is_admin()` check,
confirmed by calling each over REST with the anon key — but the intent had not
landed. `009` re-revokes in a separate migration, which does stick, and sets
`ALTER DEFAULT PRIVILEGES … REVOKE EXECUTE ON FUNCTIONS FROM anon` so later
additions do not silently widen.

**Put the REVOKE in a migration after the one that creates the function**, and
verify with `has_function_privilege` rather than assuming.

## Adding a table: the checklist

1. `ALTER TABLE … ENABLE ROW LEVEL SECURITY` — CI fails the build without it.
2. Write `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies explicitly. An absent
   policy denies; a too-broad one is worse than none.
3. For any column that encodes trust — a status, a role, a verified flag, a
   money amount — add it to a guard trigger and expose an admin RPC.
4. Any `SECURITY DEFINER` function needs `SET search_path = public, pg_temp`.
   CI checks the count.
5. New functions default to `EXECUTE` for `PUBLIC`. `REVOKE ALL … FROM PUBLIC`
   then `GRANT EXECUTE … TO authenticated` explicitly.
6. Add an audit trigger if the table records anything a regulator or a court
   might ask about.

## Reporting a vulnerability

Email `security@thesecuritywatch.com` with steps to reproduce. Please do not open
a public issue. Given the nature of the data on this platform — criminal case
files, witness communications, identity documents — we treat reports as urgent.

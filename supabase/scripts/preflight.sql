-- =============================================================================
-- PREFLIGHT — read-only. Run this BEFORE applying migrations 004–008.
-- =============================================================================
-- Nothing here writes. It answers the questions that decide whether the
-- hardening migrations will actually work against THIS database, rather than
-- against the schema the repository thinks exists.
--
-- Run in: Dashboard → SQL Editor, or `supabase db execute -f` once linked.
-- =============================================================================


-- =============================================================================
-- 1. LEFTOVER PERMISSIVE POLICIES  ← the one that matters most
-- =============================================================================
-- Postgres combines permissive policies with OR. A single leftover policy from
-- the original schema will defeat the new restrictive ones entirely.
--
-- Migration 006 drops the storage policies by the exact names used in
-- 002_storage_buckets.sql. If the production buckets were instead created
-- through the Dashboard (which the old README instructed), the real policies
-- have different names, those DROPs are silent no-ops, and the permissive rules
-- survive alongside the new ones.
--
-- EXPECTED AFTER MIGRATION: only the policies named in 006 —
--   avatars_*, evidence_*, property_images_*, property_documents_*,
--   media_reports_*, kyc_documents_*, chat_files_*, legal_documents_*
--
-- ANYTHING ELSE listed here must be dropped by name before the hardening holds.

SELECT
  'STORAGE POLICY' AS check_type,
  policyname,
  cmd,
  CASE
    WHEN policyname ~ '^(avatars|evidence|property_images|property_documents|media_reports|kyc_documents|chat_files|legal_documents)_'
      THEN 'expected — created by migration 006'
    ELSE '>>> UNEXPECTED — review and drop, or it will OR with the new policy <<<'
  END AS verdict,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY verdict DESC, policyname;


-- Same question for the public tables. Anything not created by 001/003/004/005
-- is drift that needs a decision.
SELECT
  'TABLE POLICY' AS check_type,
  tablename,
  policyname,
  cmd,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- =============================================================================
-- 2. TABLES WITHOUT RLS
-- =============================================================================
-- Any row here is readable and writable by anyone holding the anon key.

SELECT
  'RLS DISABLED' AS check_type,
  c.relname AS table_name,
  '>>> ENABLE ROW LEVEL SECURITY before going further <<<' AS verdict
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;


-- =============================================================================
-- 3. ACCOUNTS THAT MAY HAVE SELF-ASSIGNED A PRIVILEGED ROLE
-- =============================================================================
-- Until migration 004, the signup trigger copied `role` straight out of
-- client-supplied metadata. Any account whose current role matches what its
-- own signup metadata asked for could have granted itself that role.
--
-- Cross-check every row against people you actually onboarded.

SELECT
  'PRIVILEGED ACCOUNT' AS check_type,
  p.email,
  p.full_name,
  p.role AS current_role,
  u.raw_user_meta_data->>'role' AS role_requested_at_signup,
  CASE
    WHEN u.raw_user_meta_data->>'role' = p.role
      THEN '>>> matches signup metadata — could be self-assigned <<<'
    ELSE 'granted separately — likely legitimate'
  END AS verdict,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.role IN ('admin', 'investigator', 'lawyer', 'medical_expert')
ORDER BY verdict DESC, p.created_at;


-- =============================================================================
-- 4. BLOCKERS FOR THE CONSTRAINTS 004 ADDS
-- =============================================================================

-- 004 adds a UNIQUE index on payments.provider_reference. Duplicates make it
-- fail. The old mock payment service generated references from a timestamp, so
-- collisions are possible.
SELECT
  'DUPLICATE PAYMENT REF' AS check_type,
  provider_reference,
  count(*) AS occurrences,
  '>>> de-duplicate before applying 004 <<<' AS verdict
FROM public.payments
WHERE provider_reference IS NOT NULL
GROUP BY provider_reference
HAVING count(*) > 1;

-- 004 adds UNIQUE (institution_id, scorer_id) to performance_scores and DELETES
-- the older duplicates automatically. This shows what will be removed.
SELECT
  'RATING TO BE DELETED' AS check_type,
  institution_id,
  scorer_id,
  count(*) AS ratings_by_this_person,
  count(*) - 1 AS will_be_deleted
FROM public.performance_scores
GROUP BY institution_id, scorer_id
HAVING count(*) > 1;


-- =============================================================================
-- 5. SELF-DECLARED PAYMENTS
-- =============================================================================
-- Before 004, the browser wrote `status: 'completed'` directly with an amount
-- the payer typed. None of these were ever verified against Paystack. Reconcile
-- them against the Paystack dashboard — the platform cannot tell you which are
-- real.

SELECT
  'UNVERIFIED PAYMENT' AS check_type,
  count(*) AS completed_payments,
  sum(amount) AS total_amount,
  min(created_at) AS earliest,
  max(created_at) AS latest,
  '>>> reconcile against Paystack — none of these were provider-verified <<<' AS verdict
FROM public.payments
WHERE status = 'completed';


-- =============================================================================
-- 6. SCHEMA DRIFT THE APP ALREADY DEPENDS ON
-- =============================================================================
-- The app reads columns and a table that appear in no migration file. If these
-- report 'missing', 005 creates them; if they report 'exists', production drifted
-- ahead of the repository and `supabase db diff` should be committed first.

SELECT 'DRIFT' AS check_type, 'investigators.is_available' AS object,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='investigators' AND column_name='is_available'
  ) THEN 'exists in production — commit the diff' ELSE 'missing — 005 will create it' END AS verdict
UNION ALL
SELECT 'DRIFT', 'investigators.updated_at',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='investigators' AND column_name='updated_at'
  ) THEN 'exists in production — commit the diff' ELSE 'missing — 005 will create it' END
UNION ALL
SELECT 'DRIFT', 'account_deletion_requests',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='account_deletion_requests'
  ) THEN 'exists in production — commit the diff' ELSE 'missing — 005 will create it' END;


-- =============================================================================
-- 7. STORED FILE REFERENCES: URL vs PATH
-- =============================================================================
-- The old code stored getPublicUrl() output for PRIVATE buckets, which never
-- resolved — evidence and media were unreadable. The new code stores object
-- paths and signs them on read.
--
-- resolveStorageUrl() in lib/supabase.ts recovers a path from a legacy URL, so
-- evidence and chat files keep working. Media is the exception: the storage
-- policy matches media_reports.file_url against the object name exactly, so any
-- row still holding a full URL will not be publicly readable once published.

SELECT
  'EVIDENCE FILE REF' AS check_type,
  count(*) FILTER (WHERE file_url LIKE 'http%') AS legacy_urls,
  count(*) FILTER (WHERE file_url NOT LIKE 'http%') AS object_paths,
  'legacy URLs are recovered automatically on read' AS note
FROM public.evidence;

SELECT
  'MEDIA FILE REF' AS check_type,
  count(*) FILTER (WHERE file_url LIKE 'http%') AS legacy_urls,
  count(*) FILTER (WHERE file_url NOT LIKE 'http%') AS object_paths,
  '>>> legacy URLs need rewriting to object paths — see section 8 <<<' AS note
FROM public.media_reports;


-- =============================================================================
-- 8. REMEDIATION for section 7 — REVIEW BEFORE RUNNING. THIS ONE WRITES.
-- =============================================================================
-- Rewrites legacy public URLs on media_reports down to bare object paths so the
-- storage policy can match them. Run it only after the counts above show legacy
-- URLs, and only after taking a dump.
--
-- UPDATE public.media_reports
-- SET file_url = regexp_replace(
--       file_url, '^.*/object/(public|sign)/media-reports/', ''
--     )
-- WHERE file_url LIKE 'http%'
--   AND file_url LIKE '%/media-reports/%';
--
-- Same shape for evidence, if you would rather normalise than rely on the
-- runtime fallback:
--
-- UPDATE public.evidence
-- SET file_url = regexp_replace(
--       file_url, '^.*/object/(public|sign)/evidence/', ''
--     )
-- WHERE file_url LIKE 'http%'
--   AND file_url LIKE '%/evidence/%';


-- =============================================================================
-- 9. STORAGE BUCKET CONFIGURATION
-- =============================================================================
-- `evidence`, `property-documents`, `media-reports`, `kyc-documents`,
-- `chat-files` and `legal-documents` must all be private. A public bucket
-- serves its objects to anyone with the URL, whatever the policies say.

SELECT
  'BUCKET' AS check_type,
  id AS bucket,
  public,
  file_size_limit,
  CASE
    WHEN id IN ('avatars', 'property-images') AND public THEN 'correct — intentionally public'
    WHEN id IN ('avatars', 'property-images') AND NOT public THEN 'should be public'
    WHEN public THEN '>>> MUST BE PRIVATE — objects are served to anyone with the URL <<<'
    ELSE 'correct — private'
  END AS verdict
FROM storage.buckets
ORDER BY verdict DESC, id;

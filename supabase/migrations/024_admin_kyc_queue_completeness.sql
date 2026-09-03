-- ============================================================================
-- 024 — The admin queue must judge completeness the way submission does
-- ============================================================================
--
-- Reported: administrators cannot verify user submissions. Applications arrive
-- but the queue presents every one of them as incomplete and without an ID.
--
-- THE CAUSE — the same dead column 023 fixed, missed in `admin_kyc_queue`.
--
--   1. `has_id_document` is computed as `i.id_document_url IS NOT NULL`.
--      Nothing has written that column since migration 013 replaced the two
--      fixed slots with `kyc_documents`. So every applicant shows as having no
--      identification, however many they uploaded.
--
--   2. `is_complete` requires BOTH that dead column AND a non-empty
--      `professional_summary`. Migration 016 made verification a requirement of
--      every role, and a landlord, tenant or witness has no professional
--      summary to give — so those applicants could NEVER be complete, by
--      construction. Combined with (1), nothing in the queue was ever
--      actionable.
--
-- The completeness rule here now mirrors `submit_kyc_for_review()` exactly:
-- identity from either source, professional standing only where the applicant
-- is applying for a reviewed professional role, date of birth, and two
-- guarantors. A queue that disagrees with the function that accepted the
-- submission is worse than no queue — it tells an administrator the applicant
-- did not provide something the applicant demonstrably did.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_kyc_queue(p_status TEXT DEFAULT 'pending')
RETURNS TABLE (
  investigator_id  UUID,
  user_id          UUID,
  full_name        TEXT,
  email            TEXT,
  phone            TEXT,
  applied_for_role TEXT,
  requested_role   TEXT,
  verification_status TEXT,
  submitted_at     TIMESTAMPTZ,
  days_waiting     INT,
  document_count   BIGINT,
  guarantor_count  BIGINT,
  has_id_document  BOOLEAN,
  has_summary      BOOLEAN,
  is_complete      BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  RETURN QUERY
  WITH applicant AS (
    SELECT
      i.*,
      p.full_name,
      p.email,
      p.phone,
      p.requested_role,
      -- The three roles that carry professional standing. Everyone else is
      -- verified on identity alone (016).
      (p.requested_role IN ('investigator', 'lawyer', 'medical_expert')) AS is_professional,
      -- Identity from either source: the legacy slot for anything predating
      -- 013, or a government ID in the table that replaced it.
      (i.id_document_url IS NOT NULL
       OR EXISTS (
         SELECT 1 FROM public.kyc_documents d
         WHERE d.investigator_id = i.id
           AND d.document_type IN ('national_id', 'passport', 'drivers_license')
       )) AS identity_ok,
      (SELECT count(*) FROM public.kyc_documents d WHERE d.investigator_id = i.id) AS docs,
      (SELECT count(*) FROM public.guarantors g WHERE g.investigator_id = i.id) AS guarantors
    FROM public.investigators i
    JOIN public.profiles p ON p.user_id = i.user_id
  )
  SELECT
    a.id,
    a.user_id,
    a.full_name,
    a.email,
    a.phone,
    a.applied_for_role,
    a.requested_role,
    a.verification_status,
    a.submitted_at,
    CASE WHEN a.submitted_at IS NULL THEN NULL
         ELSE EXTRACT(DAY FROM now() - a.submitted_at)::int END,
    a.docs,
    a.guarantors,
    a.identity_ok,
    coalesce(trim(a.professional_summary), '') <> '',
    (
      a.identity_ok
      AND a.date_of_birth IS NOT NULL
      AND a.guarantors >= 2
      -- Only asked of the reviewed professional roles, exactly as
      -- submit_kyc_for_review() does it.
      AND (NOT a.is_professional OR coalesce(trim(a.professional_summary), '') <> '')
    )
  FROM applicant a
  WHERE (p_status IS NULL OR a.verification_status = p_status)
  ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_kyc_queue(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_kyc_queue(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_kyc_queue(TEXT) TO authenticated;

-- ── Verify ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_kyc_queue'
      AND p.prosrc LIKE '%kyc_documents%'
      AND p.prosrc LIKE '%drivers_license%'
  ) THEN
    RAISE EXCEPTION '024 failed: the queue still reads only the legacy ID column';
  END IF;

  -- The other half: a non-professional applicant must be able to be complete.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_kyc_queue'
      AND p.prosrc LIKE '%NOT a.is_professional%'
  ) THEN
    RAISE EXCEPTION '024 failed: completeness still demands a professional summary of everyone';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.admin_kyc_queue(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '024 failed: administrators cannot call the queue';
  END IF;

  RAISE NOTICE '024 verified';
END;
$$;

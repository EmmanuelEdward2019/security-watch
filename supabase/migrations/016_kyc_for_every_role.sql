-- =============================================================================
-- 016 — VERIFICATION FOR EVERY ROLE, AND A ROLE-GRANT ESCALATION FIX
-- =============================================================================
-- Until now only complainants and the three reviewed professional roles could
-- reach the verification screen. Landlords, tenants, witnesses and media agents
-- were shown a "complete your verification" banner that pointed at a page they
-- were not permitted to load, so it fell back to the profile form — display
-- name, bio, phone. No NIN, no documents, no guarantors. In practice those
-- roles had no identity verification at all.
--
-- Opening that screen to every role exposes a latent escalation in
-- admin_review_investigator(), which this migration closes first.
--
-- Requires: 004 (guard triggers, admin RPCs), 013 (KYC detail capture).
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Approving an identity check must never promote a role  (TSW-16a)
-- =============================================================================
-- The role CASE in admin_review_investigator() ended with:
--
--     ELSE 'investigator'
--
-- so approving ANY application whose profile had no professional
-- `requested_role` set the account's role to `investigator` — the role that can
-- read criminal case files, complainant identities and filed evidence.
--
-- While the verification screen was reachable only by professional applicants
-- this was merely wrong. With every role now able to submit an identity check,
-- it becomes an escalation path: a landlord confirming who they are would be
-- handed investigative access by an admin who believed they were approving a
-- NIN.
--
-- An identity check confirms identity. It grants a role only when a role was
-- explicitly applied for, and only one of the three reviewed roles.

CREATE OR REPLACE FUNCTION public.admin_review_investigator(
  p_investigator_id UUID,
  p_status          TEXT,
  p_notes           TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   UUID;
  v_requested TEXT;
  v_applied   TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may review a verification application';
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'Invalid review status: %', p_status;
  END IF;

  SELECT user_id, applied_for_role INTO v_user_id, v_applied
  FROM public.investigators WHERE id = p_investigator_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No such application';
  END IF;

  PERFORM public.tsw_elevate();

  UPDATE public.investigators
  SET verification_status = p_status,
      admin_notes         = coalesce(p_notes, admin_notes),
      updated_at          = now()
  WHERE id = p_investigator_id;

  IF p_status = 'approved' THEN
    SELECT requested_role INTO v_requested FROM public.profiles WHERE user_id = v_user_id;

    -- applied_for_role is the role recorded at submission time; requested_role
    -- is what the profile asks for now. Prefer the former — it is the thing the
    -- admin was actually looking at when they approved.
    v_requested := coalesce(
      NULLIF(v_applied, ''),
      NULLIF(v_requested, '')
    );

    UPDATE public.profiles
    SET kyc_status = 'approved',
        role = CASE
                 -- A reviewed professional role was applied for: grant it.
                 WHEN v_requested IN ('investigator','lawyer','medical_expert')
                   THEN v_requested
                 -- Otherwise the identity is confirmed and the role is
                 -- untouched. No implicit promotion, ever.
                 ELSE role
               END,
        role_confirmed_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id;

  ELSIF p_status = 'rejected' THEN
    UPDATE public.profiles
    SET kyc_status = 'rejected', updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details, severity)
  VALUES (
    auth.uid(),
    'investigator_reviewed',
    'investigator',
    p_investigator_id::text,
    jsonb_build_object(
      'status', p_status,
      'notes', p_notes,
      'subject', v_user_id,
      'role_granted', CASE
        WHEN p_status = 'approved'
         AND v_requested IN ('investigator','lawyer','medical_expert')
        THEN v_requested ELSE NULL END
    ),
    CASE WHEN p_status = 'approved' THEN 'warning' ELSE 'notice' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_investigator(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_investigator(UUID, TEXT, TEXT) TO authenticated;


-- =============================================================================
-- SECTION 2 — A profile-level "submitted" signal                     (TSW-16b)
-- =============================================================================
-- profiles.kyc_status defaults to 'pending', so 'pending' cannot distinguish
-- "never started" from "submitted, waiting on an admin". The banner therefore
-- told users who had already submitted a full application to go and start it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.kyc_submitted_at IS
  'Set by submit_kyc_for_review(). Distinguishes a pending application that has '
  'been submitted from the default kyc_status of pending on a new account.';

-- Backfill from applications that were already submitted.
UPDATE public.profiles p
SET kyc_submitted_at = i.submitted_at
FROM public.investigators i
WHERE i.user_id = p.user_id
  AND i.submitted_at IS NOT NULL
  AND p.kyc_submitted_at IS NULL;

-- The guard trigger from 004 pins kyc_status. kyc_submitted_at is written only
-- by the SECURITY DEFINER RPC below, so pin it the same way.
CREATE OR REPLACE FUNCTION public.guard_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.tsw_is_elevated() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     OR NEW.kyc_submitted_at IS DISTINCT FROM OLD.kyc_submitted_at
     OR NEW.role_confirmed_at IS DISTINCT FROM OLD.role_confirmed_at THEN
    PERFORM public.log_guard_violation(
      'profiles',
      OLD.user_id::text,
      jsonb_build_object(
        'attempted_role', NEW.role,
        'current_role', OLD.role,
        'attempted_kyc', NEW.kyc_status,
        'current_kyc', OLD.kyc_status
      )
    );
  END IF;

  -- Pin the trust-bearing columns to their stored values.
  -- Every pin from 004 is retained; kyc_submitted_at and role_confirmed_at are
  -- added. Dropping any of these would reopen TSW-02.
  NEW.role              := OLD.role;
  NEW.kyc_status        := OLD.kyc_status;
  NEW.kyc_submitted_at  := OLD.kyc_submitted_at;
  NEW.role_confirmed_at := OLD.role_confirmed_at;
  NEW.user_id           := OLD.user_id;
  NEW.email             := OLD.email;
  NEW.created_at        := OLD.created_at;
  RETURN NEW;
END;
$$;

-- The trigger already exists from 004 and points at this function by name, so
-- CREATE OR REPLACE above is enough. Re-asserted here so the migration is
-- correct even if 004's trigger were ever dropped.
DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles();


-- =============================================================================
-- SECTION 3 — Completeness rules that fit the applicant's role       (TSW-16c)
-- =============================================================================
-- submit_kyc_for_review() required a professional summary and at least one area
-- of specialisation from everyone. A landlord verifying their NIN has neither,
-- and would have been unable to submit at all.
--
-- Identity is required of every applicant. Professional standing is required
-- only of applicants for a reviewed professional role.

CREATE OR REPLACE FUNCTION public.submit_kyc_for_review()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_investigator public.investigators;
  v_requested    TEXT;
  v_docs         INT;
  v_guarantors   INT;
  v_admin        UUID;
  v_name         TEXT;
  v_professional BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_investigator
  FROM public.investigators WHERE user_id = auth.uid();

  IF v_investigator.id IS NULL THEN
    RAISE EXCEPTION 'Start your application before submitting it for review';
  END IF;

  IF v_investigator.verification_status = 'approved' THEN
    RAISE EXCEPTION 'Your application has already been approved';
  END IF;

  SELECT requested_role, full_name INTO v_requested, v_name
  FROM public.profiles WHERE user_id = auth.uid();

  v_professional := v_requested IN ('investigator', 'lawyer', 'medical_expert');

  -- ── Identity: required of everyone ──────────────────────────────────────
  IF v_investigator.id_document_url IS NULL THEN
    RAISE EXCEPTION 'Upload a government-issued ID before submitting';
  END IF;
  IF v_investigator.date_of_birth IS NULL THEN
    RAISE EXCEPTION 'Add your date of birth before submitting';
  END IF;
  IF coalesce(trim(v_investigator.residential_address), '') = '' THEN
    RAISE EXCEPTION 'Add your residential address before submitting';
  END IF;
  IF v_investigator.national_id_number IS NULL
     OR v_investigator.national_id_number !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'A valid 11-digit National Identification Number is required';
  END IF;

  -- ── Professional standing: only for the three reviewed roles ────────────
  IF v_professional THEN
    IF coalesce(trim(v_investigator.professional_summary), '') = '' THEN
      RAISE EXCEPTION 'Add a professional summary before submitting';
    END IF;
    IF array_length(v_investigator.specialization, 1) IS NULL THEN
      RAISE EXCEPTION 'Select at least one area of specialisation';
    END IF;
  END IF;

  SELECT count(*) INTO v_guarantors
  FROM public.guarantors WHERE investigator_id = v_investigator.id;

  IF v_guarantors < 2 THEN
    RAISE EXCEPTION 'Two guarantors are required. You have provided %', v_guarantors;
  END IF;

  SELECT count(*) INTO v_docs
  FROM public.kyc_documents WHERE investigator_id = v_investigator.id;

  PERFORM public.tsw_elevate();

  UPDATE public.investigators
  SET submitted_at = now(),
      verification_status = 'pending',
      applied_for_role = CASE
        WHEN v_professional THEN v_requested
        -- Non-professional applicants are verifying identity only. Leaving this
        -- NULL is what stops Section 1 from granting them a role on approval.
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = v_investigator.id;

  UPDATE public.profiles
  SET kyc_submitted_at = now(), updated_at = now()
  WHERE user_id = auth.uid();

  FOR v_admin IN SELECT user_id FROM public.profiles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_admin,
      'Verification submitted for review',
      coalesce(v_name, 'An applicant') || ' submitted a '
        || coalesce(v_requested, 'identity') || ' verification with '
        || v_guarantors || ' guarantor(s) and ' || v_docs || ' document(s).',
      'info',
      '/app/admin/verifications'
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details, severity)
  VALUES (auth.uid(), 'kyc_submitted', 'investigator', v_investigator.id::text,
          jsonb_build_object('applied_for', v_requested, 'documents', v_docs,
                             'guarantors', v_guarantors, 'professional', v_professional),
          'notice');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_kyc_for_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc_for_review() TO authenticated;


-- =============================================================================
-- SECTION 4 — An applicant may replace their own guarantors          (TSW-16d)
-- =============================================================================
-- guarantors carried SELECT and INSERT policies for the applicant and an ALL
-- policy for admins — but no DELETE for the applicant. Resubmission therefore
-- appended: an applicant rejected for one wrong phone number, who corrected it
-- and submitted again, ended up with four guarantor rows, then six, with no
-- indication to the reviewing admin which pair was current.
--
-- Scoped exactly like the kyc_documents delete policy from 013: your own
-- application, and only while it is still pending. An approved application is
-- the record of why someone was trusted and must not be editable afterwards.

DROP POLICY IF EXISTS "Applicant replaces own pending guarantors" ON public.guarantors;
CREATE POLICY "Applicant replaces own pending guarantors" ON public.guarantors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.investigators i
      WHERE i.id = investigator_id
        AND i.user_id = auth.uid()
        AND i.verification_status = 'pending'
    )
    OR public.is_admin()
  );


-- =============================================================================
-- SECTION 5 — Verify
-- =============================================================================
-- Migration 010 taught us that a grant or predicate change can look correct in
-- review and take production down. Fail the migration here rather than at 2am.

DO $$
DECLARE
  v_src TEXT;
BEGIN
  SELECT prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_review_investigator';

  IF v_src LIKE '%ELSE ''investigator''%' THEN
    RAISE EXCEPTION 'admin_review_investigator still promotes to investigator by default';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'kyc_submitted_at'
  ) THEN
    RAISE EXCEPTION 'profiles.kyc_submitted_at was not created';
  END IF;

  -- The predicate functions must stay executable by authenticated, or every
  -- read fails with 42501. This is the regression migration 011 had to repair.
  IF NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated lost EXECUTE on is_admin() — RLS predicates would fail';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guarantors' AND cmd = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'guarantors has no DELETE policy — resubmission would duplicate rows';
  END IF;

  -- The pins from 004 must all survive the guard_profiles() redefinition.
  SELECT prosrc INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'guard_profiles';

  IF v_src NOT LIKE '%NEW.email%' OR v_src NOT LIKE '%NEW.user_id%'
     OR v_src NOT LIKE '%NEW.created_at%' OR v_src NOT LIKE '%NEW.kyc_status%' THEN
    RAISE EXCEPTION 'guard_profiles() lost a column pin from migration 004';
  END IF;

  RAISE NOTICE '016 verified: no implicit role promotion, kyc_submitted_at present, guards intact.';
END;
$$;

-- ============================================================================
-- 023 — Accept an uploaded identity document                        (TSW-23)
-- ============================================================================
--
-- Reported: every professional and landlord application is blocked. The user
-- uploads a NIN and a photograph, presses submit, and is told
--
--     Upload a government-issued ID before submitting
--
-- for a document they have just uploaded. Nothing can be submitted by any role.
--
-- THE CAUSE
--
-- Migration 013 introduced `kyc_documents` and its own comment says it
-- "replaces the old two fixed slots" — `investigators.id_document_url` and
-- `service_records_url`. The clients were rewritten accordingly and now write
-- every upload to `kyc_documents`.
--
-- `submit_kyc_for_review()` was not. It still gates on the legacy column:
--
--     IF v_investigator.id_document_url IS NULL THEN
--       RAISE EXCEPTION 'Upload a government-issued ID before submitting';
--
-- Nothing writes that column any more. The only place `id_document_url` is
-- still populated is on GUARANTORS, which is a different table and a different
-- person. So the check could never pass, for anybody, no matter what they
-- uploaded.
--
-- THE FIX
--
-- Accept either: the legacy column for any application that predates 013, or
-- an identity document in `kyc_documents`. The requirement is unchanged — an
-- applicant must still provide government identification — but it is now
-- satisfied by the model the platform actually uses.
--
-- `national_id`, `passport` and `drivers_license` are the identity types, and
-- deliberately not the rest: a CV or a call-to-bar certificate is a
-- professional credential, not proof of who someone is.
-- ============================================================================

-- Returns void, matching the existing signature. Neither client reads a return
-- value — both check only `error` — so changing the shape would force a DROP
-- and take the grants with it for no benefit.
CREATE OR REPLACE FUNCTION public.submit_kyc_for_review()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_investigator public.investigators%ROWTYPE;
  v_requested    TEXT;
  v_professional BOOLEAN;
  v_guarantors   INT;
  v_docs         INT;
  v_identity     INT;
  v_name         TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_investigator
  FROM public.investigators WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Start your application before submitting it for review';
  END IF;

  IF v_investigator.verification_status = 'approved' THEN
    RAISE EXCEPTION 'Your application has already been approved';
  END IF;

  SELECT requested_role, full_name INTO v_requested, v_name
  FROM public.profiles WHERE user_id = v_user_id;

  v_professional := v_requested IN ('investigator', 'lawyer', 'medical_expert');

  -- Identity: the legacy slot, or an identity document in the table that
  -- replaced it. See the header — the old column is no longer written by any
  -- client, so checking it alone blocked every applicant.
  SELECT count(*) INTO v_identity
  FROM public.kyc_documents
  WHERE investigator_id = v_investigator.id
    AND document_type IN ('national_id', 'passport', 'drivers_license');

  IF v_investigator.id_document_url IS NULL AND v_identity = 0 THEN
    RAISE EXCEPTION 'Upload a government-issued ID before submitting';
  END IF;

  IF v_investigator.date_of_birth IS NULL THEN
    RAISE EXCEPTION 'Add your date of birth before submitting';
  END IF;

  IF coalesce(btrim(v_investigator.residential_address), '') = '' THEN
    RAISE EXCEPTION 'Add your residential address before submitting';
  END IF;

  IF coalesce(v_investigator.national_id_number, '') !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION 'A valid 11-digit National Identification Number is required';
  END IF;

  -- Professional standing is asked only of the three reviewed roles. A
  -- landlord or tenant has no professional summary to give.
  IF v_professional THEN
    IF coalesce(btrim(v_investigator.professional_summary), '') = '' THEN
      RAISE EXCEPTION 'Add a professional summary before submitting';
    END IF;

    IF v_investigator.specialization IS NULL
       OR array_length(v_investigator.specialization, 1) IS NULL THEN
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
  SET verification_status = 'pending',
      submitted_at = now(),
      applied_for_role = CASE WHEN v_professional THEN v_requested ELSE NULL END,
      updated_at = now()
  WHERE id = v_investigator.id;

  UPDATE public.profiles
  SET kyc_status = 'pending',
      kyc_submitted_at = now(),
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT p.user_id,
         'New verification to review',
         coalesce(v_name, 'An applicant') || ' submitted '
           || v_guarantors || ' guarantor(s) and ' || v_docs || ' document(s).',
         'info',
         '/app/admin/kyc'
  FROM public.profiles p WHERE p.role = 'admin';

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (v_user_id, 'kyc_submitted', 'investigator', v_investigator.id,
          jsonb_build_object('applied_for', v_requested, 'documents', v_docs,
                             'guarantors', v_guarantors, 'professional', v_professional));

END;
$$;

REVOKE ALL ON FUNCTION public.submit_kyc_for_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_kyc_for_review() FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc_for_review() TO authenticated;

-- ── Verify ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- The whole point: an uploaded identity document must now satisfy the check.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'submit_kyc_for_review'
      AND p.prosrc LIKE '%kyc_documents%'
      AND p.prosrc LIKE '%drivers_license%'
  ) THEN
    RAISE EXCEPTION '023 failed: the identity check still ignores kyc_documents';
  END IF;

  -- 016's rule must survive: non-professional applicants are not asked for a
  -- professional summary.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'submit_kyc_for_review'
      AND p.prosrc LIKE '%v_professional%'
  ) THEN
    RAISE EXCEPTION '023 failed: the professional branch was lost';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.submit_kyc_for_review()', 'EXECUTE') THEN
    RAISE EXCEPTION '023 failed: applicants cannot call the submit function';
  END IF;

  RAISE NOTICE '023 verified';
END;
$$;

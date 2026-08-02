-- =============================================================================
-- 013 — KYC DETAIL CAPTURE
-- =============================================================================
-- An admin approving a professional is deciding who gets to read criminal case
-- files, complainant identities and filed evidence. Until now that decision was
-- made on two documents and a name.
--
-- This adds the detail an admin actually needs to make it, and a place to put
-- however many supporting documents an applicant has, rather than the fixed two.
--
-- `investigators` remains the application record for all three reviewed roles
-- (investigator, lawyer, medical_expert) — the name is historical and
-- admin_review_investigator() already grants whichever role was requested.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Applicant detail
-- =============================================================================

ALTER TABLE public.investigators
  -- Identity
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS national_id_number TEXT,
  ADD COLUMN IF NOT EXISTS residential_address TEXT,
  ADD COLUMN IF NOT EXISTS state_of_residence TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Nigerian',

  -- Professional standing
  ADD COLUMN IF NOT EXISTS professional_summary TEXT,
  ADD COLUMN IF NOT EXISTS qualifications TEXT,
  ADD COLUMN IF NOT EXISTS certifications TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS licensing_body TEXT,
  ADD COLUMN IF NOT EXISTS previous_employer TEXT,
  ADD COLUMN IF NOT EXISTS previous_position TEXT,
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}',

  -- Submission tracking, so an admin can see how long an application has waited
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_for_role TEXT
    CHECK (applied_for_role IN ('investigator','lawyer','medical_expert'));

COMMENT ON COLUMN public.investigators.applied_for_role IS
  'Which reviewed role this application is for. Mirrors profiles.requested_role '
  'at submission time so the record survives a later change to the profile.';

CREATE INDEX IF NOT EXISTS idx_investigators_submitted_at
  ON public.investigators(submitted_at DESC)
  WHERE verification_status = 'pending';


-- =============================================================================
-- SECTION 2 — kyc_documents: as many supporting files as the applicant has
-- =============================================================================
-- The old flow had exactly two slots (ID, service records) plus one per
-- guarantor. A lawyer has a call-to-bar certificate; a forensic expert has
-- professional registration. There was nowhere to put them.

CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigator_id UUID NOT NULL REFERENCES public.investigators(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'national_id', 'passport', 'drivers_license', 'service_record',
    'academic_certificate', 'professional_certificate', 'call_to_bar',
    'medical_license', 'police_clearance', 'reference_letter',
    'proof_of_address', 'cv', 'other'
  )),
  label TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_investigator
  ON public.kyc_documents(investigator_id);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicant and admin read kyc documents" ON public.kyc_documents
  FOR SELECT USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.investigators i
      WHERE i.id = investigator_id AND i.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "Applicant uploads own kyc documents" ON public.kyc_documents
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.investigators i
      WHERE i.id = investigator_id AND i.user_id = auth.uid()
    )
  );

-- An applicant may withdraw a document while still under review, never after.
CREATE POLICY "Applicant deletes own pending kyc documents" ON public.kyc_documents
  FOR DELETE USING (
    (uploaded_by = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.investigators i
       WHERE i.id = investigator_id
         AND i.user_id = auth.uid()
         AND i.verification_status = 'pending'
     ))
    OR public.is_admin()
  );

-- uploaded_by is taken from the session, not the payload.
CREATE OR REPLACE FUNCTION public.guard_kyc_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.uploaded_by := COALESCE(auth.uid(), NEW.uploaded_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_documents_guard ON public.kyc_documents;
CREATE TRIGGER kyc_documents_guard
  BEFORE INSERT ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_documents();


-- =============================================================================
-- SECTION 3 — Submit for review
-- =============================================================================
-- Stamps submitted_at and records which role was applied for, so the admin queue
-- can sort by wait time and the record survives a later profile change.
--
-- Deliberately does NOT touch verification_status: that stays 'pending' and is
-- admin-only, exactly as before.

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

  -- Completeness, checked here so the same rules apply to web and mobile.
  IF v_investigator.id_document_url IS NULL THEN
    RAISE EXCEPTION 'Upload a government-issued ID before submitting';
  END IF;
  IF coalesce(trim(v_investigator.professional_summary), '') = '' THEN
    RAISE EXCEPTION 'Add a professional summary before submitting';
  END IF;
  IF v_investigator.date_of_birth IS NULL THEN
    RAISE EXCEPTION 'Add your date of birth before submitting';
  END IF;
  IF coalesce(trim(v_investigator.residential_address), '') = '' THEN
    RAISE EXCEPTION 'Add your residential address before submitting';
  END IF;
  IF array_length(v_investigator.specialization, 1) IS NULL THEN
    RAISE EXCEPTION 'Select at least one area of specialisation';
  END IF;

  SELECT count(*) INTO v_guarantors
  FROM public.guarantors WHERE investigator_id = v_investigator.id;

  IF v_guarantors < 2 THEN
    RAISE EXCEPTION 'Two guarantors are required. You have provided %', v_guarantors;
  END IF;

  SELECT count(*) INTO v_docs
  FROM public.kyc_documents WHERE investigator_id = v_investigator.id;

  SELECT requested_role, full_name INTO v_requested, v_name
  FROM public.profiles WHERE user_id = auth.uid();

  PERFORM public.tsw_elevate();

  UPDATE public.investigators
  SET submitted_at = now(),
      applied_for_role = CASE
        WHEN v_requested IN ('investigator','lawyer','medical_expert') THEN v_requested
        ELSE coalesce(applied_for_role, 'investigator')
      END,
      updated_at = now()
  WHERE id = v_investigator.id;

  -- Tell the admins there is something to review.
  FOR v_admin IN SELECT user_id FROM public.profiles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_admin,
      'Verification submitted for review',
      coalesce(v_name, 'An applicant') || ' submitted a '
        || coalesce(v_requested, 'professional') || ' application with '
        || v_guarantors || ' guarantor(s) and ' || v_docs || ' document(s).',
      'info',
      '/app/admin/verifications'
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details, severity)
  VALUES (auth.uid(), 'kyc_submitted', 'investigator', v_investigator.id::text,
          jsonb_build_object('applied_for', v_requested, 'documents', v_docs,
                             'guarantors', v_guarantors),
          'notice');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_kyc_for_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc_for_review() TO authenticated;


-- =============================================================================
-- SECTION 4 — The admin review payload, in one call
-- =============================================================================
-- Everything an admin needs to decide, assembled server-side: the profile, the
-- full application, every guarantor, and every document. Previously the review
-- screen showed two thumbnails and a rating.

CREATE OR REPLACE FUNCTION public.admin_kyc_application(p_investigator_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  SELECT jsonb_build_object(
    'investigator', to_jsonb(i) - 'admin_notes',
    'admin_notes', i.admin_notes,
    'profile', jsonb_build_object(
      'user_id', p.user_id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'avatar_url', p.avatar_url,
      'role', p.role,
      'requested_role', p.requested_role,
      'kyc_status', p.kyc_status,
      'location', p.location,
      'bio', p.bio,
      'member_since', p.created_at
    ),
    'guarantors', COALESCE((
      SELECT jsonb_agg(to_jsonb(g) ORDER BY g.created_at)
      FROM public.guarantors g WHERE g.investigator_id = i.id
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at)
      FROM public.kyc_documents d WHERE d.investigator_id = i.id
    ), '[]'::jsonb),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'action', a.action, 'severity', a.severity,
        'details', a.details, 'at', a.created_at
      ) ORDER BY a.created_at DESC)
      FROM public.audit_logs a
      WHERE a.resource_type = 'investigator' AND a.resource_id = i.id::text
    ), '[]'::jsonb)
  )
  INTO v
  FROM public.investigators i
  JOIN public.profiles p ON p.user_id = i.user_id
  WHERE i.id = p_investigator_id;

  IF v IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_kyc_application(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kyc_application(UUID) TO authenticated;


-- =============================================================================
-- SECTION 5 — Queue listing with completeness at a glance
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_kyc_queue(p_status TEXT DEFAULT 'pending')
RETURNS TABLE (
  investigator_id UUID,
  user_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  applied_for_role TEXT,
  requested_role TEXT,
  verification_status TEXT,
  submitted_at TIMESTAMPTZ,
  waiting_days INT,
  document_count BIGINT,
  guarantor_count BIGINT,
  has_id BOOLEAN,
  has_summary BOOLEAN,
  is_complete BOOLEAN
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
  SELECT
    i.id,
    i.user_id,
    p.full_name,
    p.email,
    p.phone,
    i.applied_for_role,
    p.requested_role,
    i.verification_status,
    i.submitted_at,
    CASE WHEN i.submitted_at IS NULL THEN NULL
         ELSE EXTRACT(DAY FROM now() - i.submitted_at)::int END,
    (SELECT count(*) FROM public.kyc_documents d WHERE d.investigator_id = i.id),
    (SELECT count(*) FROM public.guarantors g WHERE g.investigator_id = i.id),
    i.id_document_url IS NOT NULL,
    coalesce(trim(i.professional_summary), '') <> '',
    (i.id_document_url IS NOT NULL
     AND coalesce(trim(i.professional_summary), '') <> ''
     AND i.date_of_birth IS NOT NULL
     AND (SELECT count(*) FROM public.guarantors g WHERE g.investigator_id = i.id) >= 2)
  FROM public.investigators i
  JOIN public.profiles p ON p.user_id = i.user_id
  WHERE (p_status IS NULL OR i.verification_status = p_status)
  ORDER BY i.submitted_at DESC NULLS LAST, i.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_kyc_queue(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kyc_queue(TEXT) TO authenticated;


-- =============================================================================
-- SECTION 6 — Keep the guard aware of the new columns
-- =============================================================================
-- The applicant owns every field added in section 1. The pins are unchanged:
-- verification_status, rating, total_cases, admin_notes and user_id remain
-- admin-only. submitted_at is set only by submit_kyc_for_review().

CREATE OR REPLACE FUNCTION public.guard_investigators()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.tsw_is_elevated() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending';
    NEW.rating := 0;
    NEW.total_cases := 0;
    NEW.admin_notes := NULL;
    NEW.submitted_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.rating IS DISTINCT FROM OLD.rating THEN
    PERFORM public.log_guard_violation(
      'investigators',
      OLD.id::text,
      jsonb_build_object(
        'attempted_status', NEW.verification_status,
        'current_status', OLD.verification_status,
        'attempted_rating', NEW.rating
      )
    );
  END IF;

  NEW.verification_status := OLD.verification_status;
  NEW.rating := OLD.rating;
  NEW.total_cases := OLD.total_cases;
  NEW.admin_notes := OLD.admin_notes;
  NEW.user_id := OLD.user_id;
  NEW.submitted_at := OLD.submitted_at;
  RETURN NEW;
END;
$$;

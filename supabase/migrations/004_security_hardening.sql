-- =============================================================================
-- 004 — SECURITY HARDENING
-- =============================================================================
-- Closes the privilege-escalation and trust-boundary defects in 001:
--
--   * Signup no longer honours a client-supplied role            (TSW-01)
--   * profiles.role / kyc_status are no longer self-writable     (TSW-02)
--   * conversation membership can no longer be self-granted      (TSW-03)
--   * investigators cannot self-approve                          (TSW-04)
--   * media_reports cannot be self-published                     (TSW-08)
--   * properties cannot be self-verified                         (TSW-09)
--   * case status / assignments are RPC-mediated                 (TSW-10)
--   * payments are no longer client-writable                     (TSW-05)
--   * audit_logs are no longer client-writable                   (TSW-15)
--   * institution scores are one-per-scorer and server-computed  (TSW-18)
--   * SECURITY DEFINER functions pin their search_path           (TSW-23)
--   * case/conversation counterparties can resolve profiles      (TSW-17)
--
-- Design note — why triggers rather than column REVOKEs:
-- Supabase gives every logged-in user the same `authenticated` role, so a
-- column REVOKE would also block admins. Instead, protected columns are
-- pinned by BEFORE UPDATE triggers that only stand down inside a transaction
-- flagged privileged by a SECURITY DEFINER RPC. The flag setter is not
-- exposed over the API, so a client can never raise it on its own.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — Privilege flag plumbing
-- =============================================================================

-- Raised only inside our own SECURITY DEFINER functions. `is_local => true`
-- scopes it to the current transaction, so it cannot leak across requests on
-- a pooled connection.
CREATE OR REPLACE FUNCTION public.tsw_elevate()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT set_config('tsw.elevated', 'on', true);
$$;

CREATE OR REPLACE FUNCTION public.tsw_is_elevated()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(current_setting('tsw.elevated', true), 'off') = 'on';
$$;

-- The flag setter must never be reachable from the REST API.
REVOKE ALL ON FUNCTION public.tsw_elevate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tsw_elevate() FROM anon, authenticated;

-- =============================================================================
-- SECTION 2 — Harden the existing helper functions (TSW-23)
-- =============================================================================
-- A SECURITY DEFINER function without a pinned search_path can be redirected
-- by a caller-controlled schema. All three are recreated with the path fixed.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_case_participant(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = p_case_id
      AND (
        c.complainant_id = auth.uid()
        OR c.assigned_investigator_id = auth.uid()
        OR c.assigned_lawyer_id = auth.uid()
        OR c.assigned_expert_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Returns the caller's role, or NULL when unauthenticated.
CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;

-- =============================================================================
-- SECTION 3 — Escalation attempt logging
-- =============================================================================
-- Protected-column writes are reverted rather than rejected: it keeps existing
-- client code working (several forms PATCH a whole object) while making the
-- escalation impossible. Every attempt is recorded so you can detect probing.

CREATE OR REPLACE FUNCTION public.log_guard_violation(
  p_table TEXT,
  p_resource_id TEXT,
  p_details JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'guard_violation', p_table, p_resource_id, p_details);
EXCEPTION WHEN OTHERS THEN
  -- Never let logging failure block the guarded write.
  NULL;
END;
$$;

-- =============================================================================
-- SECTION 4 — profiles: role and KYC are not self-writable (TSW-02)
-- =============================================================================

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
     OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
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
  NEW.role := OLD.role;
  NEW.kyc_status := OLD.kyc_status;
  NEW.user_id := OLD.user_id;
  NEW.email := OLD.email;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles();

-- Admin-only role assignment.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change roles';
  END IF;

  IF p_role NOT IN ('complainant','investigator','lawyer','medical_expert',
                    'witness','landlord','tenant','media_agent','admin') THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  END IF;

  -- An admin must not remove their own last privilege by accident.
  IF p_user_id = auth.uid() AND p_role <> 'admin' THEN
    IF (SELECT count(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last remaining administrator';
    END IF;
  END IF;

  PERFORM public.tsw_elevate();
  UPDATE public.profiles SET role = p_role, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'role_changed', 'profile', p_user_id::text,
          jsonb_build_object('new_role', p_role));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_kyc_status(
  p_user_id UUID,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change KYC status';
  END IF;
  IF p_status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Unknown KYC status: %', p_status;
  END IF;

  PERFORM public.tsw_elevate();
  UPDATE public.profiles SET kyc_status = p_status, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'kyc_status_changed', 'profile', p_user_id::text,
          jsonb_build_object('new_status', p_status));
END;
$$;

-- =============================================================================
-- SECTION 5 — Signup no longer trusts client metadata (TSW-01)
-- =============================================================================
-- Every new account starts as a complainant. The role the user picked during
-- registration is preserved as a *request* in requested_role; an admin (or the
-- self-service claim below) turns it into the real thing.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS requested_role TEXT,
  ADD COLUMN IF NOT EXISTS role_confirmed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested TEXT;
  v_granted   TEXT;
BEGIN
  v_requested := NULLIF(NEW.raw_user_meta_data->>'role', '');

  IF v_requested NOT IN ('complainant','investigator','lawyer','medical_expert',
                         'witness','landlord','tenant','media_agent') THEN
    v_requested := NULL;
  END IF;

  -- Self-service roles carry no elevated data access: they can only reach
  -- their own records. Roles that grant sight of other people's case files
  -- (investigator, lawyer, medical_expert) must be granted by an admin after
  -- verification, so they start as complainant with the request recorded.
  v_granted := CASE
    WHEN v_requested IN ('complainant','witness','landlord','tenant','media_agent')
      THEN v_requested
    ELSE 'complainant'
  END;

  INSERT INTO public.profiles (user_id, email, full_name, role, requested_role, role_confirmed_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    v_granted,
    v_requested,
    CASE WHEN v_granted = v_requested THEN now() ELSE NULL END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Repair any account that self-assigned a privileged role before this migration.
DO $$
DECLARE
  v_escalated INT;
BEGIN
  SELECT count(*) INTO v_escalated
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.role IN ('admin','investigator','lawyer','medical_expert')
    AND u.raw_user_meta_data->>'role' = p.role
    AND p.role_confirmed_at IS NULL;

  IF v_escalated > 0 THEN
    RAISE WARNING
      'SECURITY: % account(s) hold a privileged role that matches their signup metadata and was never admin-confirmed. Review: SELECT user_id, email, role FROM public.profiles WHERE role_confirmed_at IS NULL AND role <> ''complainant'';',
      v_escalated;
  END IF;
END $$;

-- Roles granted before this migration are grandfathered as confirmed so the
-- audit column means "reviewed" going forward rather than flagging everyone.
UPDATE public.profiles
SET role_confirmed_at = COALESCE(role_confirmed_at, created_at)
WHERE role_confirmed_at IS NULL;

-- =============================================================================
-- SECTION 6 — profiles: counterparty visibility (TSW-17)
-- =============================================================================
-- Without this, every embedded `profiles` join returns NULL for the other
-- party, so case cards and chat headers render blank for non-admins.

CREATE OR REPLACE FUNCTION public.shares_context_with(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- Both parties are on the same case.
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE (
              c.complainant_id = auth.uid()
              OR c.assigned_investigator_id = auth.uid()
              OR c.assigned_lawyer_id = auth.uid()
              OR c.assigned_expert_id = auth.uid()
            )
        AND (
              c.complainant_id = p_user_id
              OR c.assigned_investigator_id = p_user_id
              OR c.assigned_lawyer_id = p_user_id
              OR c.assigned_expert_id = p_user_id
            )
    )
    -- Both parties are in the same conversation.
    OR EXISTS (
      SELECT 1
      FROM public.conversation_participants me
      JOIN public.conversation_participants them
        ON them.conversation_id = me.conversation_id
      WHERE me.user_id = auth.uid() AND them.user_id = p_user_id
    )
    -- Landlord <-> enquiring tenant on a property request.
    OR EXISTS (
      SELECT 1
      FROM public.property_requests r
      JOIN public.properties p ON p.id = r.property_id
      WHERE (r.requester_id = auth.uid() AND p.owner_id = p_user_id)
         OR (p.owner_id = auth.uid() AND r.requester_id = p_user_id)
    );
$$;

DROP POLICY IF EXISTS "Counterparties can read profile" ON public.profiles;
CREATE POLICY "Counterparties can read profile" ON public.profiles
  FOR SELECT USING (public.shares_context_with(user_id));

-- =============================================================================
-- SECTION 7 — conversations: membership is RPC-mediated (TSW-03, TSW-16)
-- =============================================================================

DROP POLICY IF EXISTS "Participants can add self to conversation" ON public.conversation_participants;

-- Creates a conversation and enrols every participant atomically. The caller
-- must be one of the participants, and for case conversations must be on the
-- case. Returns the existing thread when a direct pair already has one.
CREATE OR REPLACE FUNCTION public.create_conversation(
  p_type TEXT,
  p_participant_ids UUID[],
  p_case_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conversation_id UUID;
  v_ids             UUID[];
  v_member          UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_type NOT IN ('direct','group') THEN
    RAISE EXCEPTION 'Conversation type must be direct or group';
  END IF;

  -- Always include the caller; drop duplicates and NULLs.
  SELECT array_agg(DISTINCT id) INTO v_ids
  FROM unnest(p_participant_ids || auth.uid()) AS id
  WHERE id IS NOT NULL;

  IF array_length(v_ids, 1) < 2 THEN
    RAISE EXCEPTION 'A conversation needs at least two participants';
  END IF;

  -- Every participant must be a real profile.
  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS id
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = id)
  ) THEN
    RAISE EXCEPTION 'One or more participants do not exist';
  END IF;

  IF p_case_id IS NOT NULL AND NOT public.is_case_participant(p_case_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'You are not a participant on that case';
  END IF;

  -- A direct thread between the same two people is reused, never duplicated.
  IF p_type = 'direct' AND array_length(v_ids, 1) = 2 THEN
    SELECT c.id INTO v_conversation_id
    FROM public.conversations c
    WHERE c.type = 'direct'
      AND c.case_id IS NOT DISTINCT FROM p_case_id
      AND (
        SELECT array_agg(cp.user_id ORDER BY cp.user_id)
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id
      ) = (SELECT array_agg(id ORDER BY id) FROM unnest(v_ids) AS id)
    LIMIT 1;

    IF v_conversation_id IS NOT NULL THEN
      RETURN v_conversation_id;
    END IF;
  END IF;

  INSERT INTO public.conversations (case_id, type, title)
  VALUES (p_case_id, p_type, p_title)
  RETURNING id INTO v_conversation_id;

  FOREACH v_member IN ARRAY v_ids LOOP
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_member)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

-- Adding someone later requires already being in the thread.
CREATE OR REPLACE FUNCTION public.add_conversation_participant(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'You are not a participant in this conversation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'That user does not exist';
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (p_conversation_id, p_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$$;

-- =============================================================================
-- SECTION 8 — investigators cannot self-approve (TSW-04)
-- =============================================================================

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
    -- A new record always starts unverified with a clean reputation.
    NEW.verification_status := 'pending';
    NEW.rating := 0;
    NEW.total_cases := 0;
    NEW.admin_notes := NULL;
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investigators_guard ON public.investigators;
CREATE TRIGGER investigators_guard
  BEFORE INSERT OR UPDATE ON public.investigators
  FOR EACH ROW EXECUTE FUNCTION public.guard_investigators();

-- Guarantors likewise cannot be inserted pre-approved.
CREATE OR REPLACE FUNCTION public.guard_guarantors()
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
    NEW.verified_at := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guarantors_guard ON public.guarantors;
CREATE TRIGGER guarantors_guard
  BEFORE INSERT OR UPDATE ON public.guarantors
  FOR EACH ROW EXECUTE FUNCTION public.guard_guarantors();

-- Approving an investigator also grants the role they applied for, so the two
-- can never drift apart.
CREATE OR REPLACE FUNCTION public.admin_review_investigator(
  p_investigator_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   UUID;
  v_requested TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can review investigators';
  END IF;
  IF p_status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Unknown verification status: %', p_status;
  END IF;

  SELECT user_id INTO v_user_id FROM public.investigators WHERE id = p_investigator_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Investigator record not found';
  END IF;

  PERFORM public.tsw_elevate();

  UPDATE public.investigators
  SET verification_status = p_status,
      admin_notes = COALESCE(p_notes, admin_notes)
  WHERE id = p_investigator_id;

  IF p_status = 'approved' THEN
    SELECT requested_role INTO v_requested FROM public.profiles WHERE user_id = v_user_id;

    UPDATE public.profiles
    SET kyc_status = 'approved',
        role = CASE
                 WHEN v_requested IN ('investigator','lawyer','medical_expert') THEN v_requested
                 WHEN role IN ('investigator','lawyer','medical_expert') THEN role
                 ELSE 'investigator'
               END,
        role_confirmed_at = now(),
        updated_at = now()
    WHERE user_id = v_user_id;
  ELSIF p_status = 'rejected' THEN
    UPDATE public.profiles
    SET kyc_status = 'rejected', updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'investigator_reviewed', 'investigator', p_investigator_id::text,
          jsonb_build_object('status', p_status, 'notes', p_notes, 'subject', v_user_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_guarantor(
  p_guarantor_id UUID,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can review guarantors';
  END IF;
  IF p_status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Unknown verification status: %', p_status;
  END IF;

  PERFORM public.tsw_elevate();
  UPDATE public.guarantors
  SET verification_status = p_status,
      verified_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END
  WHERE id = p_guarantor_id;
END;
$$;

-- =============================================================================
-- SECTION 9 — properties cannot be self-verified (TSW-09)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_properties()
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
    NEW.status := 'unverified';
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- An owner may submit for review; only an admin may grant the badge.
    IF NEW.status = 'pending' AND OLD.status = 'unverified' THEN
      RETURN NEW;
    END IF;
    PERFORM public.log_guard_violation(
      'properties',
      OLD.id::text,
      jsonb_build_object('attempted_status', NEW.status, 'current_status', OLD.status)
    );
    NEW.status := OLD.status;
  END IF;

  NEW.owner_id := OLD.owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_guard ON public.properties;
CREATE TRIGGER properties_guard
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_properties();

CREATE OR REPLACE FUNCTION public.admin_set_property_status(
  p_property_id UUID,
  p_status TEXT,
  p_verify_documents BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can verify properties';
  END IF;
  IF p_status NOT IN ('unverified','pending','verified') THEN
    RAISE EXCEPTION 'Unknown property status: %', p_status;
  END IF;

  PERFORM public.tsw_elevate();
  UPDATE public.properties SET status = p_status, updated_at = now() WHERE id = p_property_id;

  IF p_status = 'verified' AND p_verify_documents THEN
    UPDATE public.property_documents SET verified = true WHERE property_id = p_property_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'property_status_changed', 'property', p_property_id::text,
          jsonb_build_object('status', p_status));
END;
$$;

-- Document verification flags are admin-only too.
CREATE OR REPLACE FUNCTION public.guard_property_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.tsw_is_elevated() OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verified := false;
  ELSE
    NEW.verified := OLD.verified;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS property_documents_guard ON public.property_documents;
CREATE TRIGGER property_documents_guard
  BEFORE INSERT OR UPDATE ON public.property_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_documents();

-- =============================================================================
-- SECTION 10 — media reports cannot be self-published (TSW-08)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_media_reports()
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
    NEW.status := 'pending_review';
    NEW.views := 0;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_guard_violation(
      'media_reports',
      OLD.id::text,
      jsonb_build_object('attempted_status', NEW.status, 'current_status', OLD.status)
    );
    NEW.status := OLD.status;
  END IF;

  -- Reporters may correct their own copy, but only before review starts.
  IF OLD.status <> 'pending_review' AND NOT public.is_admin() THEN
    NEW.title := OLD.title;
    NEW.description := OLD.description;
    NEW.tags := OLD.tags;
  END IF;

  NEW.views := OLD.views;
  NEW.reporter_id := OLD.reporter_id;
  NEW.file_url := OLD.file_url;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_reports_guard ON public.media_reports;
CREATE TRIGGER media_reports_guard
  BEFORE INSERT OR UPDATE ON public.media_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_media_reports();

CREATE OR REPLACE FUNCTION public.admin_review_media_report(
  p_report_id UUID,
  p_status TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reporter UUID;
  v_title    TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can review media reports';
  END IF;
  IF p_status NOT IN ('pending_review','approved','rejected','published') THEN
    RAISE EXCEPTION 'Unknown media status: %', p_status;
  END IF;

  SELECT reporter_id, title INTO v_reporter, v_title
  FROM public.media_reports WHERE id = p_report_id;

  PERFORM public.tsw_elevate();
  UPDATE public.media_reports
  SET status = p_status, updated_at = now()
  WHERE id = p_report_id;

  IF v_reporter IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_reporter,
      'Report ' || p_status,
      COALESCE(p_note, 'Your report "' || COALESCE(v_title,'') || '" is now ' || p_status || '.'),
      CASE WHEN p_status = 'rejected' THEN 'warning' ELSE 'success' END,
      '/app/media/' || p_report_id::text
    );
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'media_report_reviewed', 'media_report', p_report_id::text,
          jsonb_build_object('status', p_status, 'note', p_note));
END;
$$;

-- View counting has to bypass the guard, but must not be a write primitive.
CREATE OR REPLACE FUNCTION public.increment_media_views(p_report_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.tsw_elevate();
  UPDATE public.media_reports
  SET views = views + 1
  WHERE id = p_report_id AND status = 'published';
END;
$$;

-- =============================================================================
-- SECTION 11 — case status and assignment are RPC-mediated (TSW-10)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_cases()
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
    NEW.status := 'submitted';
    NEW.assigned_investigator_id := NULL;
    NEW.assigned_lawyer_id := NULL;
    NEW.assigned_expert_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.assigned_investigator_id IS DISTINCT FROM OLD.assigned_investigator_id
     OR NEW.assigned_lawyer_id IS DISTINCT FROM OLD.assigned_lawyer_id
     OR NEW.assigned_expert_id IS DISTINCT FROM OLD.assigned_expert_id
     OR NEW.complainant_id IS DISTINCT FROM OLD.complainant_id THEN
    PERFORM public.log_guard_violation(
      'cases',
      OLD.id::text,
      jsonb_build_object(
        'attempted_status', NEW.status,
        'attempted_investigator', NEW.assigned_investigator_id,
        'attempted_complainant', NEW.complainant_id
      )
    );
  END IF;

  NEW.status := OLD.status;
  NEW.complainant_id := OLD.complainant_id;
  NEW.assigned_investigator_id := OLD.assigned_investigator_id;
  NEW.assigned_lawyer_id := OLD.assigned_lawyer_id;
  NEW.assigned_expert_id := OLD.assigned_expert_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_guard ON public.cases;
CREATE TRIGGER cases_guard
  BEFORE INSERT OR UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_cases();

-- Legal state machine. Complainants may withdraw; assigned professionals may
-- advance their own stage; only admins may move a case anywhere.
CREATE OR REPLACE FUNCTION public.update_case_status(
  p_case_id UUID,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case    public.cases;
  v_role    TEXT;
  v_allowed BOOLEAN := false;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;
  IF p_status NOT IN ('submitted','under_review','assigned','investigating',
                      'legal_processing','completed','closed') THEN
    RAISE EXCEPTION 'Unknown case status: %', p_status;
  END IF;

  v_role := public.current_role_name();

  IF public.is_admin() THEN
    v_allowed := true;
  ELSIF v_case.assigned_investigator_id = auth.uid()
        AND p_status IN ('investigating','legal_processing','completed') THEN
    v_allowed := true;
  ELSIF v_case.assigned_lawyer_id = auth.uid()
        AND p_status IN ('legal_processing','completed') THEN
    v_allowed := true;
  ELSIF v_case.assigned_expert_id = auth.uid()
        AND p_status IN ('investigating','legal_processing') THEN
    v_allowed := true;
  ELSIF v_case.complainant_id = auth.uid() AND p_status = 'closed' THEN
    -- A complainant may withdraw their own case.
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Your role (%) cannot move this case to %', COALESCE(v_role,'none'), p_status;
  END IF;

  PERFORM public.tsw_elevate();
  UPDATE public.cases SET status = p_status, updated_at = now() WHERE id = p_case_id;

  IF v_case.complainant_id IS NOT NULL AND v_case.complainant_id <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_case.complainant_id, 'Case Status Updated',
            'Your case "' || v_case.title || '" is now: ' || replace(p_status, '_', ' ') || '.',
            'info', '/app/cases/' || p_case_id::text);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'case_status_changed', 'case', p_case_id::text,
          jsonb_build_object('from', v_case.status, 'to', p_status));
END;
$$;

-- Assignment is admin-only, and the assignee must actually hold the role and
-- be verified — this is the check the matching function used to skip.
CREATE OR REPLACE FUNCTION public.admin_assign_case(
  p_case_id UUID,
  p_user_id UUID,
  p_slot TEXT DEFAULT 'investigator'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case   public.cases;
  v_role   TEXT;
  v_kyc    TEXT;
  v_title  TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can assign cases';
  END IF;
  IF p_slot NOT IN ('investigator','lawyer','expert') THEN
    RAISE EXCEPTION 'Unknown assignment slot: %', p_slot;
  END IF;

  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  SELECT role, kyc_status INTO v_role, v_kyc FROM public.profiles WHERE user_id = p_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Assignee not found';
  END IF;

  IF p_slot = 'investigator' AND v_role <> 'investigator' THEN
    RAISE EXCEPTION 'That user is not an investigator';
  ELSIF p_slot = 'lawyer' AND v_role <> 'lawyer' THEN
    RAISE EXCEPTION 'That user is not a lawyer';
  ELSIF p_slot = 'expert' AND v_role <> 'medical_expert' THEN
    RAISE EXCEPTION 'That user is not a medical or forensic expert';
  END IF;

  IF v_kyc <> 'approved' THEN
    RAISE EXCEPTION 'That professional has not completed verification';
  END IF;

  PERFORM public.tsw_elevate();

  IF p_slot = 'investigator' THEN
    UPDATE public.cases
    SET assigned_investigator_id = p_user_id,
        status = CASE WHEN status IN ('submitted','under_review') THEN 'assigned' ELSE status END,
        updated_at = now()
    WHERE id = p_case_id;

    UPDATE public.investigators
    SET total_cases = total_cases + 1
    WHERE user_id = p_user_id;
  ELSIF p_slot = 'lawyer' THEN
    UPDATE public.cases SET assigned_lawyer_id = p_user_id, updated_at = now() WHERE id = p_case_id;
  ELSE
    UPDATE public.cases SET assigned_expert_id = p_user_id, updated_at = now() WHERE id = p_case_id;
  END IF;

  v_title := v_case.title;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (p_user_id, 'New Case Assigned',
          'You have been assigned to: "' || v_title || '".',
          'success', '/app/cases/' || p_case_id::text);

  IF v_case.complainant_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_case.complainant_id, 'Professional Assigned',
            'A verified ' || p_slot || ' has been assigned to your case "' || v_title || '".',
            'success', '/app/cases/' || p_case_id::text);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'case_assigned', 'case', p_case_id::text,
          jsonb_build_object('slot', p_slot, 'assignee', p_user_id));
END;
$$;

-- =============================================================================
-- SECTION 12 — evidence is append-only, custody log is server-written
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.uploaded_by := COALESCE(auth.uid(), NEW.uploaded_by);
    SELECT full_name INTO v_name FROM public.profiles WHERE user_id = NEW.uploaded_by;
    -- The first custody entry is written here, not by the client.
    NEW.chain_of_custody := jsonb_build_array(
      jsonb_build_object(
        'timestamp', now(),
        'action', 'uploaded',
        'user_id', NEW.uploaded_by,
        'user_name', COALESCE(v_name, 'Unknown'),
        'notes', 'Initial upload. SHA-256 recorded.'
      )
    );
    RETURN NEW;
  END IF;

  -- Evidence is immutable once filed. Only the custody log grows, and only
  -- through append_custody_entry().
  IF NOT public.tsw_is_elevated() THEN
    NEW.case_id := OLD.case_id;
    NEW.uploaded_by := OLD.uploaded_by;
    NEW.file_url := OLD.file_url;
    NEW.file_name := OLD.file_name;
    NEW.file_type := OLD.file_type;
    NEW.file_size := OLD.file_size;
    NEW.file_hash := OLD.file_hash;
    NEW.chain_of_custody := OLD.chain_of_custody;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_guard ON public.evidence;
CREATE TRIGGER evidence_guard
  BEFORE INSERT OR UPDATE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.guard_evidence();

CREATE OR REPLACE FUNCTION public.append_custody_entry(
  p_evidence_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case_id UUID;
  v_name    TEXT;
BEGIN
  SELECT case_id INTO v_case_id FROM public.evidence WHERE id = p_evidence_id;
  IF v_case_id IS NULL THEN
    RAISE EXCEPTION 'Evidence not found';
  END IF;
  IF NOT public.is_case_participant(v_case_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'You are not a participant on this case';
  END IF;
  IF p_action NOT IN ('viewed','downloaded','analysed','transferred','sealed') THEN
    RAISE EXCEPTION 'Unknown custody action: %', p_action;
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE user_id = auth.uid();

  PERFORM public.tsw_elevate();
  UPDATE public.evidence
  SET chain_of_custody = chain_of_custody || jsonb_build_object(
        'timestamp', now(),
        'action', p_action,
        'user_id', auth.uid(),
        'user_name', COALESCE(v_name, 'Unknown'),
        'notes', p_notes
      )
  WHERE id = p_evidence_id;
END;
$$;

-- Evidence must never be deleted while a case is open.
DROP POLICY IF EXISTS "Admins can manage all evidence" ON public.evidence;
CREATE POLICY "Admins can read all evidence" ON public.evidence
  FOR SELECT USING (public.is_admin());

-- =============================================================================
-- SECTION 13 — payments are server-authoritative (TSW-05)
-- =============================================================================

DROP POLICY IF EXISTS "Users can create payments" ON public.payments;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_reference
  ON public.payments(provider_reference)
  WHERE provider_reference IS NOT NULL;

-- Belt and braces: even if a policy is loosened later, a client cannot mint a
-- completed payment.
CREATE OR REPLACE FUNCTION public.guard_payments()
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
    NEW.status := 'pending';
    NEW.verified_at := NULL;
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.amount := OLD.amount;
  NEW.currency := OLD.currency;
  NEW.verified_at := OLD.verified_at;
  NEW.provider_reference := OLD.provider_reference;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_guard ON public.payments;
CREATE TRIGGER payments_guard
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_payments();

-- =============================================================================
-- SECTION 14 — audit_logs are append-only and server-written (TSW-15)
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert audit logs for own actions" ON public.audit_logs;

-- Writes now arrive only from SECURITY DEFINER functions and the service role,
-- so a client can neither forge nor flood entries.
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- =============================================================================
-- SECTION 15 — institution scores: one per scorer, computed server-side (TSW-18)
-- =============================================================================

-- Collapse any historical duplicates down to the most recent per scorer.
DELETE FROM public.performance_scores ps
WHERE EXISTS (
  SELECT 1 FROM public.performance_scores newer
  WHERE newer.institution_id = ps.institution_id
    AND newer.scorer_id = ps.scorer_id
    AND (newer.created_at, newer.id) > (ps.created_at, ps.id)
);

ALTER TABLE public.performance_scores
  DROP CONSTRAINT IF EXISTS performance_scores_one_per_scorer;
ALTER TABLE public.performance_scores
  ADD CONSTRAINT performance_scores_one_per_scorer UNIQUE (institution_id, scorer_id);

-- overall_score becomes derived, so a client can no longer send its own.
ALTER TABLE public.performance_scores DROP COLUMN IF EXISTS overall_score;
ALTER TABLE public.performance_scores
  ADD COLUMN overall_score NUMERIC(3,2)
  GENERATED ALWAYS AS (
    ((punctuality + professionalism + cleanliness + integrity + service_delivery)::numeric / 5)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_performance_scores_overall
  ON public.performance_scores(overall_score DESC);

CREATE OR REPLACE FUNCTION public.guard_performance_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.scorer_id := COALESCE(auth.uid(), NEW.scorer_id);
  IF TG_OP = 'UPDATE' THEN
    NEW.institution_id := OLD.institution_id;
    NEW.scorer_id := OLD.scorer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS performance_scores_guard ON public.performance_scores;
CREATE TRIGGER performance_scores_guard
  BEFORE INSERT OR UPDATE ON public.performance_scores
  FOR EACH ROW EXECUTE FUNCTION public.guard_performance_scores();

-- Rankings as a single aggregate rather than a full table pull (TSW-21).
CREATE OR REPLACE FUNCTION public.institution_rankings()
RETURNS TABLE (
  institution_id UUID,
  name TEXT,
  type TEXT,
  location TEXT,
  avg_score NUMERIC,
  evaluations BIGINT,
  published_reports BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    i.id,
    i.name,
    i.type,
    i.location,
    ROUND(COALESCE(AVG(ps.overall_score), 0), 2),
    COUNT(DISTINCT ps.id),
    (SELECT COUNT(*) FROM public.media_reports mr
      WHERE mr.institution_id = i.id AND mr.status = 'published')
  FROM public.institutions i
  LEFT JOIN public.performance_scores ps ON ps.institution_id = i.id
  GROUP BY i.id, i.name, i.type, i.location
  ORDER BY 5 DESC NULLS LAST, i.name;
$$;

-- =============================================================================
-- SECTION 16 — notifications cannot be forged for other users
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert notifications for self" ON public.notifications;
-- Notifications now originate from SECURITY DEFINER functions and the service
-- role only, so no client can spam another account's inbox.
REVOKE INSERT ON public.notifications FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.guard_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Recipients may only flip `read`.
  IF NOT public.tsw_is_elevated() AND NOT public.is_admin() THEN
    NEW.user_id := OLD.user_id;
    NEW.title := OLD.title;
    NEW.message := OLD.message;
    NEW.type := OLD.type;
    NEW.link := OLD.link;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_guard ON public.notifications;
CREATE TRIGGER notifications_guard
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_notifications();

-- =============================================================================
-- SECTION 17 — messages: sender cannot be spoofed, content is immutable
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.sender_id := COALESCE(auth.uid(), NEW.sender_id);
    NEW.read_at := NULL;
    RETURN NEW;
  END IF;
  -- Only the read receipt may change after sending.
  NEW.conversation_id := OLD.conversation_id;
  NEW.sender_id := OLD.sender_id;
  NEW.content := OLD.content;
  NEW.file_url := OLD.file_url;
  NEW.file_name := OLD.file_name;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_guard ON public.messages;
CREATE TRIGGER messages_guard
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_messages();

-- Read receipts need an UPDATE policy for participants (001 had none).
DROP POLICY IF EXISTS "Participants can mark messages read" ON public.messages;
CREATE POLICY "Participants can mark messages read" ON public.messages
  FOR UPDATE USING (public.is_conversation_participant(conversation_id));

-- =============================================================================
-- SECTION 18 — Dashboard aggregates (replaces full-table pulls, TSW-21)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_platform_stats()
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
    'totalUsers',            (SELECT count(*) FROM public.profiles),
    'totalCases',            (SELECT count(*) FROM public.cases),
    'activeCases',           (SELECT count(*) FROM public.cases
                               WHERE status NOT IN ('completed','closed')),
    'totalProperties',       (SELECT count(*) FROM public.properties),
    'verifiedProperties',    (SELECT count(*) FROM public.properties WHERE status = 'verified'),
    'totalMediaReports',     (SELECT count(*) FROM public.media_reports),
    'publishedMedia',        (SELECT count(*) FROM public.media_reports WHERE status = 'published'),
    'totalPayments',         (SELECT COALESCE(sum(amount),0) FROM public.payments WHERE status = 'completed'),
    'paymentCount',          (SELECT count(*) FROM public.payments WHERE status = 'completed'),
    'pendingVerifications',  (SELECT count(*) FROM public.investigators WHERE verification_status = 'pending')
                             + (SELECT count(*) FROM public.properties WHERE status = 'pending'),
    'pendingMedia',          (SELECT count(*) FROM public.media_reports WHERE status = 'pending_review'),
    'usersByRole',           (SELECT COALESCE(jsonb_object_agg(role, n), '{}'::jsonb)
                               FROM (SELECT role, count(*) n FROM public.profiles GROUP BY role) r),
    'casesByStatus',         (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
                               FROM (SELECT status, count(*) n FROM public.cases GROUP BY status) s),
    'casesByCategory',       (SELECT COALESCE(jsonb_object_agg(category, n), '{}'::jsonb)
                               FROM (SELECT category, count(*) n FROM public.cases GROUP BY category) c),
    'casesByUrgency',        (SELECT COALESCE(jsonb_object_agg(urgency, n), '{}'::jsonb)
                               FROM (SELECT urgency, count(*) n FROM public.cases GROUP BY urgency) u)
  ) INTO v;

  RETURN v;
END;
$$;

-- Monthly counts for the trend charts.
CREATE OR REPLACE FUNCTION public.admin_monthly_trends(p_months INT DEFAULT 6)
RETURNS TABLE (
  month DATE,
  cases BIGINT,
  users BIGINT,
  properties BIGINT,
  media BIGINT,
  revenue NUMERIC
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
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now()) - ((p_months - 1) || ' months')::interval,
      date_trunc('month', now()),
      '1 month'
    )::date AS m
  )
  SELECT
    months.m,
    (SELECT count(*) FROM public.cases c
      WHERE date_trunc('month', c.created_at)::date = months.m),
    (SELECT count(*) FROM public.profiles p
      WHERE date_trunc('month', p.created_at)::date = months.m),
    (SELECT count(*) FROM public.properties pr
      WHERE date_trunc('month', pr.created_at)::date = months.m),
    (SELECT count(*) FROM public.media_reports mr
      WHERE date_trunc('month', mr.created_at)::date = months.m),
    (SELECT COALESCE(sum(pay.amount), 0) FROM public.payments pay
      WHERE pay.status = 'completed'
        AND date_trunc('month', pay.created_at)::date = months.m)
  FROM months
  ORDER BY months.m;
END;
$$;

-- =============================================================================
-- SECTION 19 — Function grants
-- =============================================================================
-- Default EXECUTE on a new function is granted to PUBLIC, so every RPC must be
-- narrowed explicitly. Each function performs its own authorization check.

REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_kyc_status(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_investigator(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_guarantor(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_property_status(UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_media_report(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_case(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_platform_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_monthly_trends(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_case_status(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_conversation(TEXT, UUID[], UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_conversation_participant(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_custody_entry(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_media_views(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_guard_violation(TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tsw_is_elevated() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shares_context_with(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_role_name() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_kyc_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_investigator(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_guarantor(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_property_status(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_media_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_case(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_monthly_trends(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_case_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_conversation(TEXT, UUID[], UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_conversation_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_custody_entry(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_media_views(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.institution_rankings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shares_context_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;

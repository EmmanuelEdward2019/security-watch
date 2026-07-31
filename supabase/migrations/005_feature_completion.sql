-- =============================================================================
-- 005 — SCHEMA RECONCILIATION AND FEATURE COMPLETION
-- =============================================================================
-- Two jobs:
--
--   1. Reconcile the drift between this directory and the live database — the
--      app already reads investigators.is_available and writes to
--      account_deletion_requests, neither of which existed here.  (TSW-19, 20)
--
--   2. Create the tables behind the screens that were shipped as hardcoded
--      mock arrays: investigation reports, legal documents, forensic analyses,
--      saved properties, property verification requests, service pricing,
--      contact messages and the blog.                             (TSW-24)
--
-- Note on UUID defaults: this file uses gen_random_uuid(), which is core
-- Postgres since 13, rather than uuid_generate_v4() from uuid-ossp as the
-- original schema did. Supabase installs uuid-ossp into the `extensions`
-- schema, which is not on the search_path when the CLI applies a migration —
-- so uuid_generate_v4() resolves in the SQL editor but fails under `db push`.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — Reconciliation with the live schema (TSW-19)
-- =============================================================================

ALTER TABLE public.investigators
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_investigators_is_available
  ON public.investigators(is_available)
  WHERE is_available = true;

DROP TRIGGER IF EXISTS investigators_updated_at ON public.investigators;
CREATE TRIGGER investigators_updated_at
  BEFORE UPDATE ON public.investigators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SECTION 2 — account_deletion_requests (TSW-20)
-- =============================================================================
-- The client already writes here. Without the table the insert failed and the
-- fallback notified the departing user instead of an administrator, so erasure
-- requests vanished silently.

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  admin_notes TEXT,
  processed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_adr_open_per_user
  ON public.account_deletion_requests(user_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_adr_status ON public.account_deletion_requests(status);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own deletion request" ON public.account_deletion_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage deletion requests" ON public.account_deletion_requests
  FOR ALL USING (public.is_admin());

-- Requests are raised through an RPC so every admin is notified.
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles;
  v_id      UUID;
  v_admin   UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE user_id = auth.uid();

  SELECT id INTO v_id
  FROM public.account_deletion_requests
  WHERE user_id = auth.uid() AND status IN ('pending', 'processing');

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.account_deletion_requests (user_id, email, full_name, reason)
  VALUES (auth.uid(), v_profile.email, v_profile.full_name, p_reason)
  RETURNING id INTO v_id;

  -- Notify every administrator, not the departing user.
  FOR v_admin IN SELECT user_id FROM public.profiles WHERE role = 'admin' LOOP
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_admin,
      'Account Deletion Requested',
      v_profile.email || ' has requested erasure of their account and data.',
      'warning',
      '/app/admin/users'
    );
  END LOOP;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'account_deletion_requested', 'profile', auth.uid()::text,
          jsonb_build_object('reason', p_reason));

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(TEXT) TO authenticated;

-- =============================================================================
-- SECTION 3 — service_prices: replaces the inert pricing screen
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.service_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL CHECK (module IN ('investigation', 'property', 'media', 'security')),
  label TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_prices_module ON public.service_prices(module);

ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;

-- The public pricing page reads this, so anonymous SELECT is intentional.
CREATE POLICY "Active prices are public" ON public.service_prices
  FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage prices" ON public.service_prices
  FOR ALL USING (public.is_admin());

CREATE TRIGGER service_prices_updated_at
  BEFORE UPDATE ON public.service_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.service_prices (key, module, label, description, amount, currency, unit, sort_order) VALUES
  ('case_filing_standard',   'investigation', 'Standard case filing',        'Filing and triage of a non-urgent case',                    25000,  'NGN', 'per case', 10),
  ('case_filing_urgent',     'investigation', 'Urgent case filing',          'Priority triage for high and critical urgency cases',       60000,  'NGN', 'per case', 20),
  ('investigation_retainer', 'investigation', 'Investigator retainer',       'Two-week engagement of a verified investigator',            150000, 'NGN', 'per engagement', 30),
  ('legal_processing',       'investigation', 'Legal processing',            'Case review and documentation by a partner lawyer',         120000, 'NGN', 'per case', 40),
  ('forensic_analysis',      'investigation', 'Forensic evidence analysis',  'Medical or digital forensic examination of filed evidence',  90000,  'NGN', 'per analysis', 50),
  ('property_verification',  'property',      'Property title verification', 'Document and physical verification of a listing',           35000,  'NGN', 'per property', 10),
  ('property_listing_boost', 'property',      'Featured listing',            'Thirty days of priority placement in the marketplace',      20000,  'NGN', 'per 30 days', 20),
  ('tenant_background',      'property',      'Tenant background check',     'Identity and reference verification for a prospective tenant', 15000, 'NGN', 'per check', 30),
  ('institution_report',     'media',         'Institution report',          'Downloadable performance dossier for a single institution', 10000,  'NGN', 'per report', 10),
  ('media_archive_access',   'media',         'Archive access',              'Thirty days of access to the full transparency archive',    30000,  'NGN', 'per 30 days', 20)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- SECTION 4 — investigation_reports: investigators can finally file findings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.investigation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  findings TEXT NOT NULL,
  recommendations TEXT,
  attachments JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'accepted', 'revision_requested')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investigation_reports_case ON public.investigation_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_investigation_reports_author ON public.investigation_reports(author_id);
CREATE INDEX IF NOT EXISTS idx_investigation_reports_status ON public.investigation_reports(status);

ALTER TABLE public.investigation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants read reports" ON public.investigation_reports
  FOR SELECT USING (public.is_case_participant(case_id) OR public.is_admin());

CREATE POLICY "Assigned professionals file reports" ON public.investigation_reports
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND public.is_case_participant(case_id)
  );

CREATE POLICY "Authors edit own draft reports" ON public.investigation_reports
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin());

CREATE TRIGGER investigation_reports_updated_at
  BEFORE UPDATE ON public.investigation_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reviewer fields are not author-writable.
CREATE OR REPLACE FUNCTION public.guard_investigation_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := COALESCE(auth.uid(), NEW.author_id);
    NEW.reviewer_notes := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    NEW.case_id := OLD.case_id;
    NEW.author_id := OLD.author_id;
    NEW.reviewer_notes := OLD.reviewer_notes;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    -- Once submitted, the author can no longer rewrite the substance.
    IF OLD.status <> 'draft' AND OLD.status <> 'revision_requested' THEN
      NEW.findings := OLD.findings;
      NEW.recommendations := OLD.recommendations;
      NEW.attachments := OLD.attachments;
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS investigation_reports_guard ON public.investigation_reports;
CREATE TRIGGER investigation_reports_guard
  BEFORE INSERT OR UPDATE ON public.investigation_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_investigation_reports();

-- =============================================================================
-- SECTION 5 — legal_documents: gives the lawyer role real functionality
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'affidavit', 'petition', 'court_filing', 'legal_opinion', 'witness_statement',
    'subpoena', 'settlement', 'correspondence', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'filed', 'served', 'archived')),
  filed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_case ON public.legal_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_author ON public.legal_documents(author_id);
CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON public.legal_documents(document_type);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants read legal documents" ON public.legal_documents
  FOR SELECT USING (
    author_id = auth.uid()
    OR (case_id IS NOT NULL AND public.is_case_participant(case_id))
    OR public.is_admin()
  );

CREATE POLICY "Lawyers create legal documents" ON public.legal_documents
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND public.current_role_name() IN ('lawyer', 'admin')
    AND (case_id IS NULL OR public.is_case_participant(case_id))
  );

CREATE POLICY "Authors update own legal documents" ON public.legal_documents
  FOR UPDATE USING (author_id = auth.uid() OR public.is_admin());

CREATE POLICY "Authors delete own draft legal documents" ON public.legal_documents
  FOR DELETE USING ((author_id = auth.uid() AND status = 'draft') OR public.is_admin());

CREATE TRIGGER legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SECTION 6 — forensic_analyses: gives the medical_expert role real functionality
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.forensic_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES public.evidence(id) ON DELETE SET NULL,
  expert_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN (
    'medical_examination', 'toxicology', 'dna', 'ballistics', 'digital_forensics',
    'document_examination', 'pathology', 'psychological', 'other'
  )),
  methodology TEXT,
  findings TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'moderate'
    CHECK (confidence IN ('low', 'moderate', 'high', 'conclusive')),
  attachments JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'peer_review', 'finalised')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forensic_analyses_case ON public.forensic_analyses(case_id);
CREATE INDEX IF NOT EXISTS idx_forensic_analyses_expert ON public.forensic_analyses(expert_id);
CREATE INDEX IF NOT EXISTS idx_forensic_analyses_evidence ON public.forensic_analyses(evidence_id);

ALTER TABLE public.forensic_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case participants read analyses" ON public.forensic_analyses
  FOR SELECT USING (public.is_case_participant(case_id) OR public.is_admin());

CREATE POLICY "Experts create analyses" ON public.forensic_analyses
  FOR INSERT WITH CHECK (
    expert_id = auth.uid()
    AND public.is_case_participant(case_id)
    AND public.current_role_name() IN ('medical_expert', 'admin')
  );

CREATE POLICY "Experts update own analyses" ON public.forensic_analyses
  FOR UPDATE USING (expert_id = auth.uid() OR public.is_admin());

CREATE TRIGGER forensic_analyses_updated_at
  BEFORE UPDATE ON public.forensic_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A finalised analysis is part of the case record and stops being editable.
CREATE OR REPLACE FUNCTION public.guard_forensic_analyses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.expert_id := COALESCE(auth.uid(), NEW.expert_id);
    RETURN NEW;
  END IF;
  IF OLD.status = 'finalised' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'A finalised analysis cannot be modified';
  END IF;
  NEW.case_id := OLD.case_id;
  NEW.expert_id := OLD.expert_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forensic_analyses_guard ON public.forensic_analyses;
CREATE TRIGGER forensic_analyses_guard
  BEFORE INSERT OR UPDATE ON public.forensic_analyses
  FOR EACH ROW EXECUTE FUNCTION public.guard_forensic_analyses();

-- =============================================================================
-- SECTION 7 — saved_properties
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON public.saved_properties(user_id);

ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved properties" ON public.saved_properties
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- SECTION 8 — property_verification_requests
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.property_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'verified', 'failed', 'cancelled')),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvr_property ON public.property_verification_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_pvr_requester ON public.property_verification_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_pvr_status ON public.property_verification_requests(status);

ALTER TABLE public.property_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester owner and admin read verification requests"
  ON public.property_verification_requests
  FOR SELECT USING (
    requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "Users request verification" ON public.property_verification_requests
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Requester cancels own request" ON public.property_verification_requests
  FOR UPDATE USING (requester_id = auth.uid() OR public.is_admin());

CREATE TRIGGER pvr_updated_at
  BEFORE UPDATE ON public.property_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only an admin decides the outcome; a requester may only cancel.
CREATE OR REPLACE FUNCTION public.guard_pvr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.requester_id := COALESCE(auth.uid(), NEW.requester_id);
    NEW.status := 'pending';
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.property_id := OLD.property_id;
    NEW.requester_id := OLD.requester_id;
    NEW.admin_notes := OLD.admin_notes;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.payment_id := OLD.payment_id;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pvr_guard ON public.property_verification_requests;
CREATE TRIGGER pvr_guard
  BEFORE INSERT OR UPDATE ON public.property_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_pvr();

-- Resolving a request and stamping the property happen together.
CREATE OR REPLACE FUNCTION public.admin_resolve_verification_request(
  p_request_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.property_verification_requests;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can resolve verification requests';
  END IF;
  IF p_status NOT IN ('pending','in_review','verified','failed','cancelled') THEN
    RAISE EXCEPTION 'Unknown verification status: %', p_status;
  END IF;

  SELECT * INTO v_req FROM public.property_verification_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;

  PERFORM public.tsw_elevate();

  UPDATE public.property_verification_requests
  SET status = p_status,
      admin_notes = COALESCE(p_notes, admin_notes),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_request_id;

  IF p_status = 'verified' THEN
    UPDATE public.properties SET status = 'verified', updated_at = now() WHERE id = v_req.property_id;
    UPDATE public.property_documents SET verified = true WHERE property_id = v_req.property_id;
  ELSIF p_status = 'failed' THEN
    UPDATE public.properties SET status = 'unverified', updated_at = now() WHERE id = v_req.property_id;
  ELSIF p_status = 'in_review' THEN
    UPDATE public.properties SET status = 'pending', updated_at = now() WHERE id = v_req.property_id;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (v_req.requester_id, 'Verification ' || p_status,
          'Your property verification request is now: ' || p_status || '.',
          CASE WHEN p_status = 'failed' THEN 'warning' ELSE 'success' END,
          '/app/property/verify');

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'verification_request_resolved', 'property', v_req.property_id::text,
          jsonb_build_object('request_id', p_request_id, 'status', p_status));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_verification_request(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_verification_request(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- SECTION 9 — contact_messages: the public contact form now reaches someone
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'read', 'responded', 'closed', 'spam')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON public.contact_messages(created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a contact message" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins read contact messages" ON public.contact_messages
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update contact messages" ON public.contact_messages
  FOR UPDATE USING (public.is_admin());

CREATE TRIGGER contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Status is not submitter-controlled.
CREATE OR REPLACE FUNCTION public.guard_contact_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT public.is_admin() THEN
    NEW.status := 'new';
    NEW.admin_notes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_messages_guard ON public.contact_messages;
CREATE TRIGGER contact_messages_guard
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_contact_messages();

-- The Fountain Source form has the same shape of exposure.
CREATE OR REPLACE FUNCTION public.guard_security_service_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NOT public.is_admin() THEN
    NEW.status := 'pending';
    NEW.admin_notes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ssr_guard ON public.security_service_requests;
CREATE TRIGGER ssr_guard
  BEFORE INSERT ON public.security_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_security_service_requests();

-- =============================================================================
-- SECTION 10 — blog_posts: replaces the hardcoded newsroom
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT NOT NULL,
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'news',
  tags TEXT[] NOT NULL DEFAULT '{}',
  author_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  author_name TEXT,
  read_minutes INT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON public.blog_posts USING GIN(tags);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published posts are public" ON public.blog_posts
  FOR SELECT USING (status = 'published' OR public.is_admin());

CREATE POLICY "Admins manage posts" ON public.blog_posts
  FOR ALL USING (public.is_admin());

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- SECTION 11 — Landlord transaction view (replaces the mock ledger)
-- =============================================================================
-- Exposed as a function rather than a view so RLS on payments is not bypassed
-- and the owner check lives in one place.

CREATE OR REPLACE FUNCTION public.landlord_transactions()
RETURNS TABLE (
  payment_id UUID,
  property_id UUID,
  property_title TEXT,
  counterparty_name TEXT,
  amount NUMERIC,
  currency TEXT,
  status TEXT,
  purpose TEXT,
  reference TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pay.id,
    p.id,
    p.title,
    prof.full_name,
    pay.amount,
    pay.currency,
    pay.status,
    pay.purpose,
    pay.provider_reference,
    pay.created_at
  FROM public.payments pay
  JOIN public.properties p ON p.id = pay.property_id
  LEFT JOIN public.profiles prof ON prof.user_id = pay.payer_id
  WHERE p.owner_id = auth.uid()
  ORDER BY pay.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.landlord_transactions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.landlord_transactions() TO authenticated;

-- =============================================================================
-- SECTION 12 — Media agent activity feed (replaces the mock activity log)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.my_activity(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  title TEXT,
  detail TEXT,
  status TEXT,
  occurred_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- The inner columns are aliased explicitly: a derived table takes its column
  -- names from the first branch's expressions, so without these the ORDER BY
  -- below would be referencing a name that does not exist.
  SELECT feed.id, feed.kind, feed.title, feed.detail, feed.status, feed.occurred_at
  FROM (
    SELECT mr.id                                     AS id,
           'media_report'::text                      AS kind,
           mr.title                                  AS title,
           COALESCE(i.name, 'Unknown institution')   AS detail,
           mr.status                                 AS status,
           mr.created_at                             AS occurred_at
    FROM public.media_reports mr
    LEFT JOIN public.institutions i ON i.id = mr.institution_id
    WHERE mr.reporter_id = auth.uid()

    UNION ALL

    SELECT ps.id                                              AS id,
           'institution_score'::text                          AS kind,
           'Rated ' || COALESCE(i.name, 'an institution')     AS title,
           'Overall ' || ps.overall_score::text || ' / 5'     AS detail,
           'completed'::text                                  AS status,
           ps.created_at                                      AS occurred_at
    FROM public.performance_scores ps
    LEFT JOIN public.institutions i ON i.id = ps.institution_id
    WHERE ps.scorer_id = auth.uid()

    UNION ALL

    SELECT al.id            AS id,
           'audit'::text    AS kind,
           al.action        AS title,
           al.resource_type AS detail,
           'completed'::text AS status,
           al.created_at    AS occurred_at
    FROM public.audit_logs al
    WHERE al.user_id = auth.uid()
  ) feed
  ORDER BY feed.occurred_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.my_activity(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_activity(INT) TO authenticated;

-- =============================================================================
-- SECTION 13 — Earnings for payees (investigators, lawyers, experts)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.my_earnings()
RETURNS TABLE (
  payment_id UUID,
  case_id UUID,
  case_title TEXT,
  amount NUMERIC,
  currency TEXT,
  status TEXT,
  purpose TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    pay.id, c.id, c.title, pay.amount, pay.currency, pay.status, pay.purpose, pay.created_at
  FROM public.payments pay
  JOIN public.cases c ON c.id = pay.case_id
  WHERE c.assigned_investigator_id = auth.uid()
     OR c.assigned_lawyer_id = auth.uid()
     OR c.assigned_expert_id = auth.uid()
  ORDER BY pay.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_earnings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_earnings() TO authenticated;

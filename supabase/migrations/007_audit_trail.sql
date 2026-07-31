-- =============================================================================
-- 007 — AUDIT TRAIL
-- =============================================================================
-- The README claimed audit logging on all critical operations; the client-side
-- service that would have done it was never imported, so nothing was ever
-- recorded.                                                          (TSW-15)
--
-- A client-side audit log is unenforceable by definition — the caller decides
-- whether to write it. This migration moves the trail into database triggers,
-- which fire regardless of who is calling or through which client, and 004
-- already revoked client INSERT on audit_logs so entries cannot be forged.
-- =============================================================================

-- =============================================================================
-- SECTION 1 — Retention and query support
-- =============================================================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'notice', 'warning', 'critical'));

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
  ON public.audit_logs(severity)
  WHERE severity IN ('warning', 'critical');

-- Stamp the actor's role on every entry so a later role change does not
-- rewrite the history of what they were when they acted.
CREATE OR REPLACE FUNCTION public.stamp_audit_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.actor_role IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT role INTO NEW.actor_role FROM public.profiles WHERE user_id = NEW.user_id;
  END IF;
  IF NEW.action = 'guard_violation' THEN
    NEW.severity := 'critical';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_stamp_actor ON public.audit_logs;
CREATE TRIGGER audit_logs_stamp_actor
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_audit_actor();

-- =============================================================================
-- SECTION 2 — Generic row-change auditor
-- =============================================================================
-- Attached per table with the columns worth recording passed as trigger args,
-- so the log stays readable instead of dumping whole rows.

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_resource     TEXT := TG_ARGV[0];
  v_severity     TEXT := COALESCE(TG_ARGV[1], 'info');
  v_watch        TEXT[] := CASE WHEN TG_ARGV[2] IS NULL THEN NULL
                                ELSE string_to_array(TG_ARGV[2], ',') END;
  v_old          JSONB;
  v_new          JSONB;
  v_changes      JSONB := '{}'::jsonb;
  v_key          TEXT;
  v_resource_id  TEXT;
  v_action       TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_resource_id := v_old->>'id';
    v_action := v_resource || '_deleted';
    v_changes := jsonb_build_object('deleted_row', v_old);
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_resource_id := v_new->>'id';
    v_action := v_resource || '_created';
    IF v_watch IS NOT NULL THEN
      FOREACH v_key IN ARRAY v_watch LOOP
        v_changes := v_changes || jsonb_build_object(v_key, v_new->v_key);
      END LOOP;
    END IF;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_resource_id := v_new->>'id';
    v_action := v_resource || '_updated';

    IF v_watch IS NOT NULL THEN
      FOREACH v_key IN ARRAY v_watch LOOP
        IF v_old->v_key IS DISTINCT FROM v_new->v_key THEN
          v_changes := v_changes || jsonb_build_object(
            v_key, jsonb_build_object('from', v_old->v_key, 'to', v_new->v_key)
          );
        END IF;
      END LOOP;

      -- Nothing we care about moved; stay quiet rather than filling the table.
      IF v_changes = '{}'::jsonb THEN
        RETURN NULL;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details, severity)
  VALUES (auth.uid(), v_action, v_resource, v_resource_id, v_changes, v_severity);

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Auditing must never be the reason a legitimate write fails.
  RETURN NULL;
END;
$$;

-- =============================================================================
-- SECTION 3 — Attach to the tables that matter
-- =============================================================================

-- profiles: role and KYC movements are the highest-value signal in the system.
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('profile', 'warning', 'role,kyc_status,email');

-- cases
DROP TRIGGER IF EXISTS audit_cases_insert ON public.cases;
CREATE TRIGGER audit_cases_insert
  AFTER INSERT ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('case', 'notice', 'title,category,urgency,status');

DROP TRIGGER IF EXISTS audit_cases_update ON public.cases;
CREATE TRIGGER audit_cases_update
  AFTER UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'case', 'notice',
    'status,assigned_investigator_id,assigned_lawyer_id,assigned_expert_id,complainant_id');

-- evidence: every filing and every custody append.
DROP TRIGGER IF EXISTS audit_evidence_insert ON public.evidence;
CREATE TRIGGER audit_evidence_insert
  AFTER INSERT ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('evidence', 'warning', 'case_id,file_name,file_hash,file_size');

DROP TRIGGER IF EXISTS audit_evidence_update ON public.evidence;
CREATE TRIGGER audit_evidence_update
  AFTER UPDATE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('evidence', 'warning', 'file_hash,file_url,chain_of_custody');

DROP TRIGGER IF EXISTS audit_evidence_delete ON public.evidence;
CREATE TRIGGER audit_evidence_delete
  AFTER DELETE ON public.evidence
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('evidence', 'critical');

-- investigators: verification decisions.
DROP TRIGGER IF EXISTS audit_investigators ON public.investigators;
CREATE TRIGGER audit_investigators
  AFTER UPDATE ON public.investigators
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('investigator', 'warning', 'verification_status,rating,total_cases');

-- payments: money movement.
DROP TRIGGER IF EXISTS audit_payments_insert ON public.payments;
CREATE TRIGGER audit_payments_insert
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('payment', 'notice', 'amount,currency,provider,purpose,status');

DROP TRIGGER IF EXISTS audit_payments_update ON public.payments;
CREATE TRIGGER audit_payments_update
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('payment', 'warning', 'status,amount,verified_at');

-- properties: the verified badge.
DROP TRIGGER IF EXISTS audit_properties ON public.properties;
CREATE TRIGGER audit_properties
  AFTER UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('property', 'notice', 'status,price,owner_id,is_active');

-- media_reports: publication decisions.
DROP TRIGGER IF EXISTS audit_media_reports ON public.media_reports;
CREATE TRIGGER audit_media_reports
  AFTER UPDATE ON public.media_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('media_report', 'notice', 'status,title');

-- investigation reports and forensic analyses form part of the case record.
DROP TRIGGER IF EXISTS audit_investigation_reports ON public.investigation_reports;
CREATE TRIGGER audit_investigation_reports
  AFTER INSERT OR UPDATE ON public.investigation_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('investigation_report', 'notice', 'case_id,status,title');

DROP TRIGGER IF EXISTS audit_forensic_analyses ON public.forensic_analyses;
CREATE TRIGGER audit_forensic_analyses
  AFTER INSERT OR UPDATE ON public.forensic_analyses
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('forensic_analysis', 'notice', 'case_id,status,analysis_type,confidence');

DROP TRIGGER IF EXISTS audit_legal_documents ON public.legal_documents;
CREATE TRIGGER audit_legal_documents
  AFTER INSERT OR UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('legal_document', 'notice', 'case_id,status,document_type');

-- conversation membership: who gained sight of a thread, and when.
DROP TRIGGER IF EXISTS audit_conversation_participants ON public.conversation_participants;
CREATE TRIGGER audit_conversation_participants
  AFTER INSERT OR DELETE ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('conversation_participant', 'warning');

-- account deletion requests.
DROP TRIGGER IF EXISTS audit_account_deletion ON public.account_deletion_requests;
CREATE TRIGGER audit_account_deletion
  AFTER UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('account_deletion_request', 'warning', 'status,processed_by');

-- service prices: an admin changing what people are charged.
DROP TRIGGER IF EXISTS audit_service_prices ON public.service_prices;
CREATE TRIGGER audit_service_prices
  AFTER UPDATE ON public.service_prices
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('service_price', 'warning', 'amount,currency,is_active');

-- =============================================================================
-- SECTION 4 — Admin read API
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_audit_log(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  p_action TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  severity TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
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
  WITH filtered AS (
    SELECT al.*
    FROM public.audit_logs al
    WHERE (p_action IS NULL OR al.action = p_action)
      AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
      AND (p_severity IS NULL OR al.severity = p_severity)
      AND (p_user_id IS NULL OR al.user_id = p_user_id)
  )
  SELECT
    f.id, f.user_id, p.full_name, f.actor_role, f.action, f.resource_type,
    f.resource_id, f.details, f.severity, f.created_at,
    (SELECT count(*) FROM filtered)
  FROM filtered f
  LEFT JOIN public.profiles p ON p.user_id = f.user_id
  ORDER BY f.created_at DESC
  LIMIT GREATEST(LEAST(p_limit, 500), 1)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_audit_log(INT, INT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_audit_log(INT, INT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- Counts unresolved security signals for the admin dashboard banner.
CREATE OR REPLACE FUNCTION public.admin_security_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  SELECT jsonb_build_object(
    'guardViolations24h', (SELECT count(*) FROM public.audit_logs
                            WHERE action = 'guard_violation' AND created_at > now() - interval '24 hours'),
    'guardViolationsTotal', (SELECT count(*) FROM public.audit_logs WHERE action = 'guard_violation'),
    'criticalEvents7d', (SELECT count(*) FROM public.audit_logs
                          WHERE severity = 'critical' AND created_at > now() - interval '7 days'),
    'roleChanges7d', (SELECT count(*) FROM public.audit_logs
                       WHERE action IN ('role_changed', 'profile_updated')
                         AND details ? 'role' AND created_at > now() - interval '7 days'),
    'unconfirmedPrivilegedRoles', (SELECT count(*) FROM public.profiles
                                    WHERE role IN ('admin','investigator','lawyer','medical_expert')
                                      AND role_confirmed_at IS NULL),
    'openDeletionRequests', (SELECT count(*) FROM public.account_deletion_requests
                              WHERE status IN ('pending','processing'))
  ) INTO v;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_security_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_security_summary() TO authenticated;

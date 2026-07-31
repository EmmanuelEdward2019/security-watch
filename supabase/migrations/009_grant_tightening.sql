-- =============================================================================
-- 009 — GRANT TIGHTENING
-- =============================================================================
-- Two gaps found by auditing production after 004–008 were applied. Neither is
-- exploitable — both are defence in depth behind a check that already holds —
-- but both are cases where the earlier migration expressed an intent the
-- database did not end up reflecting, and that gap should not be left to rot.
--
--   1. `REVOKE ALL ON FUNCTION … FROM PUBLIC` in 004 did not survive. Supabase
--      runs an event trigger that auto-grants EXECUTE on new functions in the
--      `public` schema to anon, authenticated and service_role, and it fires
--      after the statements in the migration. Verified against production:
--
--        admin_set_user_role  →  anon=X/postgres | authenticated=X/postgres
--
--      Not exploitable: every admin RPC opens with its own is_admin() check and
--      raises otherwise, which was confirmed by calling each one over REST with
--      the anon key —
--        admin_set_user_role   → "Only administrators can change roles"
--        admin_platform_stats  → "Administrators only"
--        update_case_status    → "Your role (none) cannot move this case"
--
--      Revoking anyway, because a function reachable by anon is one refactor
--      away from being a function whose guard someone removes.
--
--      Note that tsw_elevate — the one that actually matters — did keep its
--      revoke (acl: postgres=X | service_role=X only), so the privilege flag was
--      never reachable.
--
--   2. `payments` still carries an INSERT grant for `authenticated`. RLS denies
--      it (004 dropped the insert policy and left none, verified: a forged
--      completed payment returns 42501), but the grant should not be there
--      either. Same for the columns a client must never write.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Admin-only RPCs: revoke anon
-- =============================================================================
-- These all check is_admin() internally. An anonymous caller has no auth.uid()
-- and so can never pass, but there is no reason for the grant to exist.

DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'admin_set_user_role(uuid, text)',
    'admin_set_kyc_status(uuid, text)',
    'admin_review_investigator(uuid, text, text)',
    'admin_review_guarantor(uuid, text)',
    'admin_set_property_status(uuid, text, boolean)',
    'admin_review_media_report(uuid, text, text)',
    'admin_assign_case(uuid, uuid, text)',
    'admin_platform_stats()',
    'admin_monthly_trends(integer)',
    'admin_audit_log(integer, integer, text, text, text, uuid)',
    'admin_security_summary()',
    'admin_resolve_verification_request(uuid, text, text)',
    'update_case_status(uuid, text)',
    'create_conversation(text, uuid[], uuid, text)',
    'add_conversation_participant(uuid, uuid)',
    'append_custody_entry(uuid, text, text)',
    'request_account_deletion(text)',
    'landlord_transactions()',
    'my_earnings()',
    'my_activity(integer)',
    'shares_context_with(uuid)',
    'current_role_name()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- Deliberately left callable by anon — the public archive and pricing page read
-- these without a session:
--   institution_rankings()
--   increment_media_views(uuid)
--   storage_uuid_prefix(text)
--   can_read_media_object(text)

-- The privilege flag setter stays unreachable by every client role.
REVOKE ALL ON FUNCTION public.tsw_elevate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tsw_is_elevated() FROM anon;
REVOKE ALL ON FUNCTION public.log_guard_violation(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- SECTION 2 — payments: revoke the write grants outright
-- =============================================================================
-- RLS already denies this (no INSERT policy exists, and guard_payments pins
-- status). Removing the grant means the denial does not depend on a policy
-- staying absent.
--
-- Payments are written only by payments-initialize and payments-webhook, both of
-- which use the service-role key and bypass both layers.

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated, anon;

-- Evidence is append-only for participants: they may file it, never remove it.
-- 006 gives the storage bucket the same shape (no UPDATE policy at all).
REVOKE DELETE ON public.evidence FROM authenticated, anon;

-- Ratings may be submitted and revised by their author, never deleted — a
-- rating that can be withdrawn on demand is a rating that can be laundered.
REVOKE DELETE ON public.performance_scores FROM authenticated, anon;


-- =============================================================================
-- SECTION 3 — Re-assert on future functions
-- =============================================================================
-- The event trigger that granted anon in the first place fires on CREATE. This
-- default keeps it from silently re-widening anything added later in this
-- schema by a migration that forgets to revoke.

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- =============================================================================
-- 017 — REVOKE EXECUTE ON TRIGGER FUNCTIONS CREATED AFTER 010
-- =============================================================================
-- Supabase installs an event trigger that grants EXECUTE on every new function
-- in `public` to `anon` and `authenticated`, and it runs *after* the statements
-- in a migration. Migration 010 revoked those grants for the trigger functions
-- that existed at the time, but two have been created since:
--
--   * guard_kyc_documents()  — trigger,       added by 013
--   * rls_auto_enable()      — event_trigger, pre-existing but never revoked
--
-- Both are reported by the Supabase security advisor as
-- `anon_security_definer_function_executable`.
--
-- The practical risk is low: PostgREST does not expose functions returning
-- `trigger` or `event_trigger`, and calling one directly raises "can only be
-- called as a trigger". This is defence in depth — the grant serves no purpose,
-- and leaving noise in the advisor makes a real finding easier to miss.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS DELIBERATELY NARROW
-- ---------------------------------------------------------------------------
-- Migration 010 followed the same advisor further and revoked EXECUTE on
-- is_admin() and friends. That took production down with `ERROR 42501` on every
-- authenticated read, and 011 had to restore it.
--
-- The trap: a function invoked inside an RLS policy expression is checked
-- against the CALLER's EXECUTE privilege, not the definer's. SECURITY DEFINER
-- governs what a function may *do*, never permission to *run* it. So every
-- predicate helper — is_admin, is_case_participant, is_conversation_participant,
-- owns_property, shares_context_with, can_read_media_object, current_role_name
-- — must remain executable by anon and authenticated, and the advisor will keep
-- flagging them. That is expected and must not be "fixed".
--
-- This migration therefore touches ONLY functions whose return type is `trigger`
-- or `event_trigger`. Those can never appear in a policy expression, so
-- revoking them cannot reproduce the 010 outage.
-- =============================================================================

REVOKE ALL ON FUNCTION public.guard_kyc_documents() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()     FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- VERIFY
-- =============================================================================
DO $$
DECLARE
  v_leftover TEXT;
  v_broken   TEXT;
BEGIN
  -- 1. No trigger or event-trigger function in public may be caller-executable.
  SELECT string_agg(p.proname, ', ')
  INTO v_leftover
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prorettype IN ('trigger'::regtype, 'event_trigger'::regtype)
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));

  IF v_leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Trigger functions still executable by anon/authenticated: %', v_leftover;
  END IF;

  -- 2. Every RLS predicate helper must STILL be executable, or reads break.
  --    This is the assertion migration 010 did not have.
  SELECT string_agg(fn, ', ')
  INTO v_broken
  FROM (
    SELECT unnest(ARRAY[
      'is_admin()',
      'is_case_participant(uuid)',
      'is_conversation_participant(uuid)',
      'owns_property(uuid)',
      'shares_context_with(uuid)',
      'can_read_media_object(text)',
      'current_role_name()'
    ]) AS fn
  ) t
  WHERE NOT has_function_privilege('authenticated', 'public.' || fn, 'EXECUTE');

  IF v_broken IS NOT NULL THEN
    RAISE EXCEPTION 'RLS predicate helpers lost EXECUTE for authenticated: % — this is the 010 regression', v_broken;
  END IF;

  RAISE NOTICE '017 verified: trigger functions locked down, RLS predicates intact.';
END;
$$;

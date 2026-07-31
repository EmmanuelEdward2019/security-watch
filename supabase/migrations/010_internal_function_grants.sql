-- =============================================================================
-- 010 — REVOKE EXECUTE ON INTERNAL FUNCTIONS
-- =============================================================================
-- Supabase's security advisor flags every SECURITY DEFINER function in `public`
-- that carries an EXECUTE grant for anon or authenticated, because each one is
-- reachable at /rest/v1/rpc/<name>.
--
-- For the trigger functions the finding is not exploitable — PostgREST refuses
-- to expose a function returning `trigger`, verified against production:
--
--   POST /rest/v1/rpc/guard_profiles
--     → PGRST202 "no matches were found in the schema cache"
--
-- The grants are removed anyway. An advisor report full of benign warnings is an
-- advisor report nobody reads, and the next real finding would be lost in it.
--
-- Predicates like is_admin() are also revoked from the API surface. They only
-- ever answer questions about the caller (anon calling is_admin() returned
-- `false`), but they exist to be called from policies, where the definer's
-- rights apply regardless of the caller's grants — so nothing needs them
-- exposed.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Trigger functions
-- =============================================================================
-- Invoked by the trigger machinery as the table owner, never by a client.

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND t.typname = 'trigger'
      AND p.proname <> 'rls_auto_enable'   -- Supabase platform function
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
  END LOOP;
END $$;


-- =============================================================================
-- SECTION 2 — Policy predicates and internal helpers
-- =============================================================================
-- Called from inside RLS policies and other SECURITY DEFINER functions, where
-- the definer's own rights apply. No client needs to reach them.
--
-- shares_context_with() is the exception and keeps its authenticated grant: the
-- send-notification-email function calls it over PostgREST, as the caller, to
-- decide whether they may email a given recipient. That check only works if the
-- caller can execute it.

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_case_participant(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owns_property(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_read_media_object(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_uuid_prefix(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_role_name() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- payments-initialize calls is_case_participant() as the caller to confirm the
-- payer belongs to the case they are paying against.
GRANT EXECUTE ON FUNCTION public.is_case_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_context_with(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;


-- =============================================================================
-- SECTION 3 — Public read surface stays public
-- =============================================================================
-- Re-asserted after the sweep above, so a future edit to this file cannot
-- silently take the transparency archive offline.

GRANT EXECUTE ON FUNCTION public.institution_rankings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_media_views(UUID) TO anon, authenticated;

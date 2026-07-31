-- =============================================================================
-- 011 — RESTORE EXECUTE ON RLS POLICY PREDICATES  (fixes a regression in 010)
-- =============================================================================
-- 010 revoked EXECUTE on is_admin(), is_case_participant() and the other
-- predicates, following Supabase's security advisor, which flags every
-- SECURITY DEFINER function in `public` that anon or authenticated can execute.
--
-- That was wrong, and it broke reads for every signed-in user:
--
--   SELECT count(*) FROM public.cases;
--     → ERROR 42501: permission denied for function is_admin
--
-- When a function is invoked from inside an RLS policy expression, Postgres
-- checks the EXECUTE privilege of the *calling* role, not of the function's
-- definer. SECURITY DEFINER governs what the function may do once it runs; it
-- does not grant permission to run it. So a policy reading
-- `USING (… OR is_admin())` requires every role subject to that policy to hold
-- EXECUTE on is_admin().
--
-- The grants are restored below. These predicates are safe to expose: each one
-- answers a yes/no question about the caller's own relationship to a row, and
-- leaks nothing about anyone else. Calling is_admin() as an anonymous user
-- returns `false`.
--
-- The advisor's underlying point still stands — these should not sit on the
-- REST surface at all. The correct fix is to move them into a schema PostgREST
-- does not expose (see the note at the bottom), not to revoke EXECUTE.
--
-- 010's Section 1 remains correct and is left alone: trigger functions run as
-- the table owner through the trigger machinery, so revoking client EXECUTE on
-- them changes nothing except silencing a false positive.
-- =============================================================================

-- Used by policies on virtually every table, and evaluated for anonymous
-- callers too wherever a policy reads `… OR is_admin()`.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- evidence, investigation_reports, forensic_analyses, legal_documents, and the
-- `evidence` storage bucket.
GRANT EXECUTE ON FUNCTION public.is_case_participant(UUID) TO anon, authenticated;

-- conversations, conversation_participants, messages, and the `chat-files`
-- storage bucket.
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO anon, authenticated;

-- The `property-documents` storage bucket.
GRANT EXECUTE ON FUNCTION public.owns_property(UUID) TO anon, authenticated;

-- The `media-reports` storage bucket — evaluated for anonymous visitors, who
-- may read an object once its report is published.
GRANT EXECUTE ON FUNCTION public.can_read_media_object(TEXT) TO anon, authenticated;

-- Every storage policy keys off the first path segment.
GRANT EXECUTE ON FUNCTION public.storage_uuid_prefix(TEXT) TO anon, authenticated;

-- The counterparty-visibility policy on profiles.
GRANT EXECUTE ON FUNCTION public.shares_context_with(UUID) TO anon, authenticated;

-- The insert policies on legal_documents and forensic_analyses.
GRANT EXECUTE ON FUNCTION public.current_role_name() TO anon, authenticated;

-- =============================================================================
-- Verification, executed as part of the migration
-- =============================================================================
-- If a predicate is still unreachable the migration fails here rather than
-- leaving the platform in the state 010 produced.

DO $$
DECLARE
  fn   TEXT;
  role TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.is_admin()',
    'public.is_case_participant(uuid)',
    'public.is_conversation_participant(uuid)',
    'public.owns_property(uuid)',
    'public.can_read_media_object(text)',
    'public.storage_uuid_prefix(text)',
    'public.shares_context_with(uuid)',
    'public.current_role_name()'
  ] LOOP
    FOREACH role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF NOT has_function_privilege(role, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'Policy predicate % is not executable by % — RLS reads would fail', fn, role;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- Follow-up, deliberately not done here
-- =============================================================================
-- To satisfy the advisor properly these predicates should live in a schema that
-- PostgREST does not expose:
--
--   CREATE SCHEMA IF NOT EXISTS private;
--   -- recreate each predicate as private.is_admin() etc.
--   -- rewrite every policy that references them
--   GRANT USAGE ON SCHEMA private TO anon, authenticated;
--
-- That touches every policy in the database, so it belongs in its own migration
-- with its own verification pass — not bolted onto a regression fix.

-- ============================================================================
-- 019 — Remove anon's redundant grants on media_library              (TSW-19)
-- ============================================================================
--
-- Supabase installs an event trigger that grants full table privileges on every
-- new table in `public` to `anon` and `authenticated`, and it runs AFTER the
-- statements in a migration. So 018 created media_library and the platform
-- immediately handed anon SELECT, INSERT, UPDATE and DELETE on it.
--
-- RLS already blocks all of it. Verified against production after 018 landed:
--
--   GET  /rest/v1/media_library  as anon -> []
--   POST /rest/v1/media_library  as anon -> 42501, new row violates
--                                           row-level security policy
--
-- because every policy on the table requires `owner_id = auth.uid()` or
-- `is_admin()`, and auth.uid() is NULL for an anonymous caller.
--
-- This is therefore defence in depth, not a fix for a live hole. It is worth
-- doing anyway for the same reason as 014: the grant serves no purpose, a
-- future policy edit could turn a redundant grant into a real one, and leaving
-- known-harmless findings in the security advisor is how a real finding gets
-- missed.
--
-- ---------------------------------------------------------------------------
-- DELIBERATELY NARROW — read this before extending it
-- ---------------------------------------------------------------------------
-- Migration 010 followed the advisor past table grants into function EXECUTE
-- and revoked it on is_admin() and friends. That took production down with
-- ERROR 42501 on every authenticated read, and 011 had to restore it.
--
-- The trap: a function invoked inside an RLS policy expression is checked
-- against the CALLER's EXECUTE privilege, not the definer's. SECURITY DEFINER
-- governs what a function may DO, never permission to RUN it.
--
-- This migration touches TABLE grants for `anon` only. It does not revoke
-- EXECUTE on anything, and it does not touch `authenticated` — which needs its
-- grants, because RLS is what scopes an authenticated user to their own rows.
-- ============================================================================

REVOKE ALL ON TABLE public.media_library FROM anon;

-- The two library RPCs are for signed-in users. 018 already granted EXECUTE to
-- `authenticated` only, but the event trigger may have added anon alongside it.
-- Safe to revoke: neither is referenced by any RLS policy expression, so this
-- cannot repeat 010 — both are called directly from the client instead.
REVOKE ALL ON FUNCTION public.attach_library_item_to_case(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.submit_library_item_to_admin(UUID, UUID, TEXT, TEXT, TEXT[]) FROM anon;

-- ── Verify ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_anon_privs INT;
  v_auth_privs INT;
BEGIN
  SELECT count(*) INTO v_anon_privs
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'media_library' AND grantee = 'anon';

  IF v_anon_privs > 0 THEN
    RAISE EXCEPTION '019 failed: anon still holds % privilege(s) on media_library', v_anon_privs;
  END IF;

  -- The regression that matters. If this migration ever takes `authenticated`
  -- down with it, every media agent loses their own library.
  SELECT count(*) INTO v_auth_privs
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'media_library' AND grantee = 'authenticated';

  IF v_auth_privs = 0 THEN
    RAISE EXCEPTION '019 failed: authenticated lost its grants on media_library';
  END IF;

  -- The 010 regression check, kept in every migration that touches grants.
  IF NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION '019 failed: authenticated lost EXECUTE on is_admin() — this breaks every read';
  END IF;

  RAISE NOTICE '019 verified';
END;
$$;

-- ============================================================================
-- 020 — No profile until the address is proved, and reap what is abandoned
-- ============================================================================
--
-- Reported: someone mistypes their address at signup, goes back to correct it,
-- and is told the email is already in use — for an account they can neither
-- sign into nor delete, because it was never confirmed. The typo now squats a
-- real person's address.
--
-- WHAT THIS CAN AND CANNOT DO
-- ---------------------------
-- It cannot stop the `auth.users` row being created. `supabase.auth.signUp()`
-- writes it immediately and the OTP is bound to it; there is no setting or API
-- that holds a signup in limbo until confirmation. Anyone who tells you
-- otherwise is describing a different auth provider.
--
-- What it can do is the part that is actually ours:
--
--   1. Stop writing a `profiles` row for an address nobody has proved they
--      own. The profile is created when the address is confirmed instead.
--   2. Delete unconfirmed `auth.users` rows after a grace period, which frees
--      the address so a corrected retry behaves like a first-time signup.
--
-- WHY DEFERRING THE PROFILE IS SAFE NOW, AND WOULD NOT HAVE BEEN BEFORE
-- ---------------------------------------------------------------------
-- Both clients now refuse an unconfirmed session: sign-in signs them straight
-- back out, and signUp discards an auto-confirmed session. So nothing
-- authenticated can be reached without a confirmed address, and no screen can
-- encounter the missing profile.
--
-- It is also the right default for this platform. A profile row carries a name,
-- an email and a requested role. Holding that for someone who never completed
-- signup — possibly someone whose address a stranger typed by accident — is
-- data we have no reason to keep.
-- ============================================================================

-- ── SECTION 1 — create the profile at confirmation, not at signup ───────────

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
  -- Nothing to do until the address has been proved. On INSERT this is almost
  -- always NULL; the UPDATE trigger below fires when it stops being NULL.
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Confirmation can be recorded more than once (a re-confirmation, an admin
  -- edit). The profile must not be recreated, and must never be reset — doing
  -- so would silently strip a granted role back to complainant.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_requested := NULLIF(NEW.raw_user_meta_data->>'role', '');

  IF v_requested NOT IN ('complainant','investigator','lawyer','medical_expert',
                         'witness','landlord','tenant','media_agent') THEN
    v_requested := NULL;
  END IF;

  -- Unchanged from the original. Self-service roles carry no elevated data
  -- access: they can only reach their own records. Roles that grant sight of
  -- other people's case files (investigator, lawyer, medical_expert) must be
  -- granted by an admin after verification, so they start as complainant with
  -- the request recorded.
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

-- The INSERT trigger stays: it covers a project configured to auto-confirm, and
-- any path that creates an already-confirmed user (an admin invite, a social
-- login). In the ordinary case it now returns without writing anything.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- The new one. Fires only on the transition to confirmed, so an ordinary
-- profile update on auth.users does not re-run it.
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- ── SECTION 2 — backfill anyone confirmed but profileless ───────────────────
--
-- Nobody should be in this state, but a confirmed user without a profile cannot
-- use the platform at all, and that is not a failure mode to leave to chance.

INSERT INTO public.profiles (user_id, email, full_name, role, requested_role, role_confirmed_at)
SELECT
  u.id,
  u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), u.email),
  'complainant',
  NULLIF(u.raw_user_meta_data->>'role', ''),
  NULL
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email_confirmed_at IS NOT NULL
  AND p.user_id IS NULL;

-- ── SECTION 3 — free addresses held by abandoned signups ────────────────────

CREATE OR REPLACE FUNCTION public.reap_unconfirmed_signups(p_older_than INTERVAL DEFAULT '24 hours')
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INT;
BEGIN
  -- Callable by administrators only. Deleting auth.users is not something a
  -- client should ever be able to trigger, whatever the arguments.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  -- A floor on the grace period. Passing '0 seconds' would delete signups that
  -- are mid-flight, with the user reading the code off their phone.
  IF p_older_than < INTERVAL '1 hour' THEN
    RAISE EXCEPTION 'Grace period must be at least 1 hour';
  END IF;

  WITH doomed AS (
    DELETE FROM auth.users
    WHERE email_confirmed_at IS NULL
      AND created_at < now() - p_older_than
      -- Belt and braces. An account that has ever been signed into is not an
      -- abandoned signup, whatever its confirmation state says.
      AND last_sign_in_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO v_deleted FROM doomed;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.reap_unconfirmed_signups(INTERVAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reap_unconfirmed_signups(INTERVAL) FROM anon;
GRANT EXECUTE ON FUNCTION public.reap_unconfirmed_signups(INTERVAL) TO authenticated;

COMMENT ON FUNCTION public.reap_unconfirmed_signups(INTERVAL) IS
  'Deletes never-signed-into, unconfirmed signups older than the grace period, '
  'freeing the address for a corrected retry. Administrators only. Schedule it '
  'with pg_cron, or call it from the admin console.';

-- ── SECTION 4 — verify ──────────────────────────────────────────────────────

DO $$
DECLARE
  v_orphans INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_confirmed' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '020 failed: on_auth_user_confirmed trigger was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '020 failed: on_auth_user_created trigger was lost';
  END IF;

  -- The regression that would matter most: a confirmed user with no profile
  -- cannot use the platform at all.
  SELECT count(*) INTO v_orphans
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.email_confirmed_at IS NOT NULL AND p.user_id IS NULL;

  IF v_orphans > 0 THEN
    RAISE EXCEPTION '020 failed: % confirmed user(s) have no profile', v_orphans;
  END IF;

  -- 010's lesson, checked in every migration that touches functions.
  IF NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION '020 failed: authenticated lost EXECUTE on is_admin()';
  END IF;

  RAISE NOTICE '020 verified';
END;
$$;

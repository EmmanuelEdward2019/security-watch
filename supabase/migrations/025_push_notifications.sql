-- ============================================================================
-- 025 — Push notification delivery
-- ============================================================================
--
-- `notifications` has existed since 001 and works: triggers and edge functions
-- write rows, and both clients read them. What has never existed is a way to
-- tell anyone a row appeared. A complainant learns their case was assigned when
-- they next happen to open the app, which for most people is days.
--
-- This adds the transport. Three things it deliberately does NOT do:
--
-- 1. It does not put case content in the push payload by default.
--    A push traverses Expo, then Apple or Google, and lands on a lock screen
--    that anyone holding the phone can read. "Investigation opened into Sgt.
--    Adeyemi" on a lock screen is not a notification, it is an exposure — and
--    the people most likely to be reporting a police officer are the people
--    most likely to have their phone taken from them. So the default payload
--    is a bare "You have a new update"; the real title and body are fetched
--    from the table after the app opens, behind the session. A user who wants
--    previews can turn them on per account (`profiles.push_show_preview`).
--
-- 2. It does not let a client write a token row directly. Tokens arrive
--    through an RPC that binds them to `auth.uid()`. Otherwise one account
--    could register another account's device and read its notifications off
--    the lock screen.
--
-- 3. It does not fire on write. There is no pg_net here and no trigger
--    reaching out to the network — a failed HTTP call inside a trigger would
--    roll back the notification that caused it. Delivery is a sweep: an edge
--    function claims a batch, sends it, and marks it. A push that fails is a
--    push that gets retried, and never a case update that vanishes.
-- ============================================================================

-- ── SECTION 1 — where a device is remembered ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_tokens (
  -- The Expo token is the natural key. A device that reinstalls gets a new
  -- one; a device that is handed to somebody else keeps the same one, which
  -- is exactly why SECTION 2 reassigns rather than inserts.
  token           TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  -- Shown in a "your devices" list so a user can recognise what they are
  -- revoking. Free text from the device; never trusted for anything else.
  device_name     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set when Expo tells us the token is dead, or when the user signs out.
  -- Kept rather than deleted so a returning device is recognised.
  disabled_at     TIMESTAMPTZ,
  disabled_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
-- The dispatcher's hot path: live tokens for a set of users.
CREATE INDEX IF NOT EXISTS idx_push_tokens_live
  ON public.push_tokens(user_id) WHERE disabled_at IS NULL;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Read to show a device list, delete to revoke one. No INSERT and no UPDATE
-- policy: both go through the RPCs below, so `user_id` is never client-chosen.
DROP POLICY IF EXISTS "Users can read own push tokens" ON public.push_tokens;
CREATE POLICY "Users can read own push tokens" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.push_tokens FROM anon;
GRANT SELECT, DELETE ON public.push_tokens TO authenticated;

-- Off by default. See the note at the top: this is the setting that decides
-- whether a case title can appear on a lock screen.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_show_preview BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.push_show_preview IS
  'When false (default) a push carries no case content — only a generic prompt to open the app.';

-- Delivery bookkeeping. NULL means "not yet sent"; the partial index below is
-- what makes the sweep cheap as the table grows, since the vast majority of
-- rows are settled and never looked at again.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_attempts SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON public.notifications(created_at)
  WHERE pushed_at IS NULL;

-- ── SECTION 2 — registering a device ────────────────────────────────────────

-- A token can outlive an account on the same handset: sign out, someone else
-- signs in, Expo hands back the same string. Inserting would collide; ignoring
-- the collision would keep delivering the previous user's notifications to a
-- phone they no longer hold. So a re-registration REASSIGNS the token and
-- clears any disabled flag.
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_token       TEXT,
  p_platform    TEXT,
  p_device_name TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_platform NOT IN ('ios', 'android') THEN
    RAISE EXCEPTION 'Unknown platform: %', p_platform;
  END IF;

  -- Expo's own format. Rejecting anything else keeps junk out of the batch
  -- the dispatcher builds, where one bad entry costs the whole request.
  IF p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' THEN
    RAISE EXCEPTION 'Not an Expo push token';
  END IF;

  INSERT INTO public.push_tokens (token, user_id, platform, device_name)
  VALUES (p_token, auth.uid(), p_platform, left(coalesce(p_device_name, ''), 120))
  ON CONFLICT (token) DO UPDATE SET
    user_id         = auth.uid(),
    platform        = EXCLUDED.platform,
    device_name     = EXCLUDED.device_name,
    last_seen_at    = now(),
    disabled_at     = NULL,
    disabled_reason = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) TO authenticated;

-- Called on sign-out. Deletes rather than disables: the row carries no history
-- worth keeping, and a user signing out on a shared or seized phone should
-- leave nothing behind that ties the handset to them.
CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.push_tokens
  WHERE token = p_token AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.unregister_push_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(TEXT) TO authenticated;

-- ── SECTION 3 — what the dispatcher claims ──────────────────────────────────

-- Claims a batch and marks it in one statement, so two dispatcher runs
-- overlapping cannot send the same notification twice. `SKIP LOCKED` is what
-- makes concurrent runs safe rather than merely unlikely.
--
-- `pushed_at` is set at CLAIM time, not on success. A duplicate push is a
-- nuisance; a notification stuck in a retry loop against a permanently
-- unreachable device is a queue that never drains. `push_attempts` records
-- what happened for anyone looking into a missed alert.
CREATE OR REPLACE FUNCTION public.claim_push_batch(p_limit INT DEFAULT 100)
RETURNS TABLE (
  notification_id UUID,
  token           TEXT,
  platform        TEXT,
  title           TEXT,
  body            TEXT,
  link            TEXT,
  show_preview    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT n.id
    FROM public.notifications n
    WHERE n.pushed_at IS NULL
      -- Anything older than a day is stale news. Pushing "your case was
      -- assigned" three days late is worse than not pushing it, and this is
      -- also the backstop that stops a long outage from spamming everyone on
      -- recovery.
      AND n.created_at > now() - INTERVAL '24 hours'
    ORDER BY n.created_at
    LIMIT GREATEST(LEAST(p_limit, 500), 1)
    FOR UPDATE SKIP LOCKED
  ),
  marked AS (
    UPDATE public.notifications n
    SET pushed_at = now(), push_attempts = n.push_attempts + 1
    FROM claimed c
    WHERE n.id = c.id
    RETURNING n.id, n.user_id, n.title, n.message, n.link
  )
  SELECT
    m.id,
    t.token,
    t.platform,
    m.title,
    m.message,
    m.link,
    p.push_show_preview
  FROM marked m
  JOIN public.push_tokens t ON t.user_id = m.user_id AND t.disabled_at IS NULL
  JOIN public.profiles p ON p.user_id = m.user_id;
END;
$$;

-- The dispatcher runs as the service role. No client may ever call this: it
-- returns other people's notification titles.
REVOKE ALL ON FUNCTION public.claim_push_batch(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_batch(INT) TO service_role;

-- Expo answers a send with a per-message status, and a token that has been
-- uninstalled comes back as DeviceNotRegistered. Left alone, dead tokens
-- accumulate and every future batch wastes its budget on handsets that no
-- longer exist.
CREATE OR REPLACE FUNCTION public.disable_push_token(
  p_token  TEXT,
  p_reason TEXT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.push_tokens
  SET disabled_at = now(), disabled_reason = left(coalesce(p_reason, 'unknown'), 200)
  WHERE token = p_token;
$$;

REVOKE ALL ON FUNCTION public.disable_push_token(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disable_push_token(TEXT, TEXT) TO service_role;

-- ── SECTION 4 — the preview setting ─────────────────────────────────────────

-- A plain profile UPDATE would do, but routing it through an RPC keeps the
-- decision auditable and gives the clients one obvious call to make.
CREATE OR REPLACE FUNCTION public.set_push_preview(p_show BOOLEAN)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.profiles
  SET push_show_preview = coalesce(p_show, false)
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.set_push_preview(BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_push_preview(BOOLEAN) TO authenticated;

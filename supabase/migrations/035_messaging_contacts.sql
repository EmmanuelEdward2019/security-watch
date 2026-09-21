-- ============================================================================
-- 035 — Who can message whom, decided once
-- ============================================================================
--
-- 034 made `create_conversation` work. This makes it USABLE, and makes the
-- rule about who may message whom a single thing both clients share.
--
-- ── WHAT WAS WRONG ──────────────────────────────────────────────────────────
--
-- 1. NOBODY COULD REACH THE TEAM. A person's contact list is whatever RLS on
--    `profiles` lets them read, which for anyone but an administrator is
--    `shares_context_with()`: a shared case, a shared conversation, or a
--    property enquiry. Administrators are never on a case, so they were
--    invisible to every user on the platform. A complainant with a problem
--    had no one to write to.
--
-- 2. THE LIST AND THE RULE WERE DIFFERENT THINGS. The web picker selected
--    `profiles` directly — capped at 50 with no search, so an administrator
--    could not find the 51st user — while `create_conversation` checked only
--    that participants exist. It never asked whether the caller was allowed to
--    reach them, so the only thing standing between any user and any other
--    was not knowing their user_id.
--
-- 3. THE MOBILE APP HAD NO WAY IN AT ALL. It deliberately offered no "new
--    conversation" button, on the stated basis that threads are created by
--    the server when a case is assigned. Nothing does that — no trigger, no
--    function, no edge function ever calls `create_conversation`. Together
--    with the shadowing bug 034 fixes, no mobile user has ever been able to
--    have a conversation.
--
-- ── THE RULE ────────────────────────────────────────────────────────────────
--
-- You may message someone when any of these holds:
--
--   * you are an administrator — the team must be able to reach anyone;
--   * they are an administrator — anyone must be able to reach the team;
--   * you share a case, a conversation or a property enquiry with them
--     (`shares_context_with`, unchanged since 004).
--
-- `can_message()` states it once. `messaging_contacts()` lists exactly the
-- people it admits, and `create_conversation()` refuses anyone it does not.
-- The list can no longer offer someone the server will reject, and the server
-- can no longer accept someone the list would never have shown.
--
-- ── WHAT THE LIST EXPOSES ───────────────────────────────────────────────────
--
-- Name, avatar and role. Never email, phone or location. Making the team
-- visible to every user must not make the team's phone numbers visible to
-- every user, so this is a function with a fixed projection rather than a
-- widened SELECT policy on `profiles`.
-- ============================================================================


-- ── SECTION 1 — the rule ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_message(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND p_user_id IS NOT NULL
    AND p_user_id <> auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles t WHERE t.user_id = p_user_id)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles t
        WHERE t.user_id = p_user_id AND t.role = 'admin'
      )
      OR public.shares_context_with(p_user_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_message(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_message(UUID) TO authenticated;


-- ── SECTION 2 — the list ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.messaging_contacts(
  p_search TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 50
)
RETURNS TABLE (
  user_id    UUID,
  full_name  TEXT,
  avatar_url TEXT,
  role       TEXT,
  is_team    BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- LIKE metacharacters in the search are literal. Without this a search for
  -- "%" matches everyone, and "_" matches any single character.
  v_term TEXT := NULLIF(
    replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_'),
    ''
  );
  v_admin BOOLEAN := public.is_admin();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.role,
    (p.role = 'admin') AS is_team
  FROM public.profiles p
  WHERE public.can_message(p.user_id)
    AND (
      v_term IS NULL
      OR p.full_name ILIKE '%' || v_term || '%'
      -- Administrators may search by email, which they can already read. For
      -- anyone else it would be a way to test whether an address belongs to
      -- a member of the team.
      OR (v_admin AND p.email ILIKE '%' || v_term || '%')
    )
  -- The team first: for most people it is the only reason to open this list.
  ORDER BY (p.role = 'admin') DESC, p.full_name NULLS LAST
  LIMIT GREATEST(LEAST(coalesce(p_limit, 50), 200), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.messaging_contacts(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messaging_contacts(TEXT, INT) TO authenticated;


-- ── SECTION 3 — enforce it where conversations are made ────────────────────
--
-- 034's function with one added check, after the existence test and before
-- anything is written. Repeated in full because CREATE OR REPLACE takes the
-- whole body; the only change is the block marked NEW.

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
  SELECT array_agg(DISTINCT t.participant_id) INTO v_ids
  FROM unnest(p_participant_ids || auth.uid()) AS t(participant_id)
  WHERE t.participant_id IS NOT NULL;

  IF array_length(v_ids, 1) < 2 THEN
    RAISE EXCEPTION 'A conversation needs at least two participants';
  END IF;

  -- Every participant must be a real profile. Qualified on both sides, so the
  -- comparison cannot quietly become profiles.user_id = profiles.id again.
  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS t(participant_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = t.participant_id
    )
  ) THEN
    RAISE EXCEPTION 'One or more participants do not exist';
  END IF;

  -- NEW (035): and the caller must be allowed to reach every one of them.
  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS t(participant_id)
    WHERE t.participant_id <> auth.uid()
      AND NOT public.can_message(t.participant_id)
  ) THEN
    RAISE EXCEPTION 'You can only message people you share a case, conversation or property enquiry with, or The Security Watch team';
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
      ) = (
        SELECT array_agg(t.participant_id ORDER BY t.participant_id)
        FROM unnest(v_ids) AS t(participant_id)
      )
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

REVOKE ALL ON FUNCTION public.create_conversation(TEXT, UUID[], UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_conversation(TEXT, UUID[], UUID, TEXT) TO authenticated;


-- ── SECTION 4 — verification ────────────────────────────────────────────────

DO $verify$
BEGIN
  IF has_function_privilege('anon', 'public.messaging_contacts(text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '035 failed: messaging_contacts is callable by anon';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_conversation' AND prosrc LIKE '%can_message(t.participant_id)%'
  ) THEN
    RAISE EXCEPTION '035 failed: create_conversation does not enforce can_message';
  END IF;

  -- 034's fix must survive this replacement.
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_conversation' AND prosrc LIKE '%unnest(v_ids) AS id%'
  ) THEN
    RAISE EXCEPTION '035 failed: create_conversation regressed to the shadowed alias';
  END IF;
END
$verify$;

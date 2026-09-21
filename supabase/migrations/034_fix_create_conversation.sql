-- ============================================================================
-- 034 — Messaging has never worked
-- ============================================================================
--
-- `create_conversation` raises 'One or more participants do not exist' for
-- every caller and every participant, including the caller themselves. No
-- conversation can be started by anyone, in either client, and never could be
-- since 004 introduced the function.
--
-- ── THE BUG ─────────────────────────────────────────────────────────────────
--
--   IF EXISTS (
--     SELECT 1 FROM unnest(v_ids) AS id
--     WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = id)
--   ) THEN
--     RAISE EXCEPTION 'One or more participants do not exist';
--
-- `profiles` has its own `id` column — a surrogate primary key — separate from
-- `user_id`, which is the auth.users reference (001):
--
--   id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id)
--
-- In that correlated subquery the unqualified `id` is resolved against the
-- INNERMOST FROM first. That is `public.profiles p`, which HAS a column named
-- `id` — so `id` binds to `p.id` and the unnest alias is shadowed. The test
-- silently becomes:
--
--     WHERE p.user_id = p.id
--
-- which is false for every row, because those two columns are different UUIDs
-- by construction. `NOT EXISTS` is therefore true for every participant, the
-- outer `EXISTS` always fires, and the function always raises.
--
-- It reads correctly. It type-checks. It is valid SQL. It is simply asking a
-- different question from the one it appears to ask, and the failure message
-- accuses the data rather than the query — which is why this survived: the
-- error says the users do not exist, so that is where everyone looked.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────
--
-- Name the unnest column explicitly, so it cannot be shadowed by any column of
-- any table joined inside a subquery. `t(participant_id)` shares its name with
-- nothing in `profiles`.
--
-- The two other `unnest(...) AS id` uses in this function are safe — neither
-- has another table in scope — but both are renamed anyway. A pattern that
-- fails silently when a table is added later is not one to leave lying around.
-- ============================================================================

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


-- ── Verification ────────────────────────────────────────────────────────────

DO $verify$
BEGIN
  -- The shadowed form must be gone. If this still matches, the replacement did
  -- not take and messaging is still dead.
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_conversation'
      AND prosrc LIKE '%unnest(v_ids) AS id%'
  ) THEN
    RAISE EXCEPTION '034 failed: create_conversation still uses the shadowed unnest alias';
  END IF;
END
$verify$;

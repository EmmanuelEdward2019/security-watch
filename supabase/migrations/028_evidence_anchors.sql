-- ============================================================================
-- 028 — Early digest anchoring
-- ============================================================================
--
-- The platform's central claim is that stored evidence is unchanged since
-- receipt. Receipt has always meant "when the bytes finished uploading", and in
-- the conditions this app actually runs in that is a weak moment to anchor to.
--
-- The recording that matters is made where there is no signal, or where taking
-- a phone out long enough to upload forty megabytes is not a thing anyone would
-- do. So the file sits on the device — sometimes for days — and arrives with a
-- timestamp the platform cannot vouch for. "Captured Tuesday 9pm, uploaded
-- Friday" is an invitation to argue about what happened in between.
--
-- A hash fixes this, because a digest is a commitment. You cannot produce a
-- SHA-256 for bytes you do not yet have. So the device hashes at capture and
-- sends the digest — 64 characters, which will go through on a connection that
-- would never carry the video — and the server records WHEN IT SAW THAT
-- DIGEST. When the file eventually arrives and matches, the certificate can
-- state something materially stronger:
--
--   this digest was registered with the platform at 21:04 on Tuesday,
--   the bytes arrived on Friday, and they match.
--
-- Which is no longer a claim about a device clock. It is a claim about the
-- platform's own record, and it narrows the window in which the file could
-- have been fabricated to the minutes before it was anchored.
--
-- WHAT THIS IS NOT. Not a blockchain, and not a trusted third-party timestamp
-- under RFC 3161. The attesting party is The Security Watch, the same party
-- storing the evidence, so this is a strengthening of an internal record, not
-- independent notarisation. The certificate says so in those words rather than
-- implying more. If independent anchoring is ever needed, this table is the
-- place it would hook in — one digest per row, already timestamped.
-- ============================================================================

-- ── SECTION 1 — the commitment ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.evidence_anchors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  -- Same shape the evidence table enforces, so a digest can never be anchored
  -- in a form that could not later match an upload.
  digest      TEXT NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),

  -- THE VALUE OF THIS TABLE. Server clock, not the device's, and not writable
  -- by anyone.
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The device's own account of when it recorded. Kept because it is useful,
  -- labelled because it is unverified: a phone's clock is whatever its owner
  -- set it to. The certificate must never present this as established.
  captured_at TIMESTAMPTZ,

  media_type  TEXT CHECK (media_type IN ('photo', 'video', 'audio', 'document')),
  byte_size   BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),

  -- Known at capture only when the recording was made from inside a case.
  case_id     UUID REFERENCES public.cases(id) ON DELETE SET NULL,

  -- Filled when the bytes finally arrive and match.
  evidence_id UUID REFERENCES public.evidence(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One anchor per digest per person. A repeat anchor of the same bytes must
  -- not overwrite the first, because the FIRST time is the whole point — an
  -- attacker who could re-anchor could move the record forward to a moment
  -- that suits them.
  CONSTRAINT one_anchor_per_digest_per_user UNIQUE (user_id, digest)
);

CREATE INDEX IF NOT EXISTS idx_evidence_anchors_user ON public.evidence_anchors(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_anchors_digest ON public.evidence_anchors(digest);
CREATE INDEX IF NOT EXISTS idx_evidence_anchors_evidence ON public.evidence_anchors(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_anchors_pending
  ON public.evidence_anchors(user_id, anchored_at DESC)
  WHERE evidence_id IS NULL;

ALTER TABLE public.evidence_anchors ENABLE ROW LEVEL SECURITY;

-- The person who anchored can see their own. Case participants can see the
-- anchors attached to evidence on their case, because that is what makes the
-- claim checkable by the people it is meant to convince.
DROP POLICY IF EXISTS "Anchors are readable by their author" ON public.evidence_anchors;
CREATE POLICY "Anchors are readable by their author" ON public.evidence_anchors
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Case participants can read case anchors" ON public.evidence_anchors;
CREATE POLICY "Case participants can read case anchors" ON public.evidence_anchors
  FOR SELECT USING (
    case_id IS NOT NULL AND (public.is_case_participant(case_id) OR public.is_admin())
  );

-- Nothing is client-writable. An anchor whose timestamp its own author could
-- set attests to nothing at all.
REVOKE ALL ON public.evidence_anchors FROM anon;
GRANT SELECT ON public.evidence_anchors TO authenticated;

-- ── SECTION 2 — anchoring ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.anchor_evidence_digest(
  p_digest      TEXT,
  p_captured_at TIMESTAMPTZ DEFAULT NULL,
  p_media_type  TEXT DEFAULT NULL,
  p_byte_size   BIGINT DEFAULT NULL,
  p_case_id     UUID DEFAULT NULL
)
RETURNS TABLE (
  anchor_id   UUID,
  anchored_at TIMESTAMPTZ,
  already_anchored BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id   UUID;
  v_at   TIMESTAMPTZ;
  v_new  BOOLEAN := true;
  v_today INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_digest IS NULL OR p_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Not a SHA-256 digest';
  END IF;

  IF p_case_id IS NOT NULL AND NOT public.is_case_participant(p_case_id) THEN
    RAISE EXCEPTION 'Not a participant in that case';
  END IF;

  -- A cheap call that writes a durable row is a cheap way to fill a table.
  -- The ceiling is far above any real day of field work — a media agent
  -- shooting continuously will not approach it — and far below what makes
  -- flooding worthwhile.
  -- Aliased and qualified: `anchored_at` is also an OUT parameter of this
  -- function, and plpgsql rejects the unqualified reference as ambiguous.
  SELECT count(*) INTO v_today
  FROM public.evidence_anchors a
  WHERE a.user_id = v_user AND a.anchored_at > now() - INTERVAL '24 hours';

  IF v_today >= 500 THEN
    RAISE EXCEPTION 'Too many anchors today';
  END IF;

  -- A device that anchors, loses its network before it sees the reply, and
  -- retries must get the ORIGINAL time back, not a new one. Hence DO NOTHING
  -- and a re-read, rather than an upsert that would move the timestamp.
  INSERT INTO public.evidence_anchors (
    user_id, digest, captured_at, media_type, byte_size, case_id
  )
  VALUES (
    v_user, p_digest, p_captured_at, p_media_type, p_byte_size, p_case_id
  )
  ON CONFLICT (user_id, digest) DO NOTHING
  RETURNING id, evidence_anchors.anchored_at INTO v_id, v_at;

  IF v_id IS NULL THEN
    v_new := false;
    SELECT a.id, a.anchored_at INTO v_id, v_at
    FROM public.evidence_anchors a
    WHERE a.user_id = v_user AND a.digest = p_digest;
  END IF;

  RETURN QUERY SELECT v_id, v_at, NOT v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.anchor_evidence_digest(TEXT, TIMESTAMPTZ, TEXT, BIGINT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.anchor_evidence_digest(TEXT, TIMESTAMPTZ, TEXT, BIGINT, UUID)
  TO authenticated;

-- ── SECTION 3 — closing the loop when the bytes arrive ──────────────────────

-- Matching is on the digest and nothing else. The uploader cannot nominate
-- which anchor to claim, so an anchor can only ever be satisfied by the exact
-- bytes that produced it.
CREATE OR REPLACE FUNCTION public.link_evidence_anchor(p_evidence_id UUID)
RETURNS TABLE (
  matched     BOOLEAN,
  anchored_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hash   TEXT;
  v_case   UUID;
  v_owner  UUID;
  v_anchor public.evidence_anchors;
BEGIN
  SELECT e.file_hash, e.case_id, e.uploaded_by
    INTO v_hash, v_case, v_owner
  FROM public.evidence e
  WHERE e.id = p_evidence_id;

  IF v_hash IS NULL THEN
    RETURN QUERY SELECT false, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF NOT (public.is_case_participant(v_case) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not a participant in that case';
  END IF;

  -- Scoped to the uploader. Anchors are personal commitments — matching
  -- against anyone's anchor would let one person's upload inherit another
  -- person's timestamp.
  SELECT * INTO v_anchor
  FROM public.evidence_anchors a
  WHERE a.user_id = v_owner AND a.digest = v_hash
  ORDER BY a.anchored_at
  LIMIT 1;

  IF v_anchor.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  UPDATE public.evidence_anchors
  SET evidence_id  = p_evidence_id,
      fulfilled_at = COALESCE(fulfilled_at, now()),
      case_id      = COALESCE(case_id, v_case)
  WHERE id = v_anchor.id;

  -- Written into the same chain of custody the certificate prints, in the
  -- shape migration 004's trigger established (timestamp / action / user_id /
  -- user_name / notes). A different shape here would render as empty cells.
  UPDATE public.evidence e
  SET chain_of_custody = e.chain_of_custody || jsonb_build_array(
    jsonb_build_object(
      'timestamp', now(),
      'action', 'digest_anchor_matched',
      'user_id', v_owner,
      'user_name', COALESCE(
        (SELECT full_name FROM public.profiles WHERE user_id = v_owner), 'Unknown'
      ),
      'notes', 'SHA-256 was registered with the platform at '
               || to_char(v_anchor.anchored_at AT TIME ZONE 'UTC',
                          'YYYY-MM-DD"T"HH24:MI:SS"Z"')
               || ', before these bytes were uploaded. The digest matches.'
    )
  )
  WHERE e.id = p_evidence_id;

  RETURN QUERY SELECT true, v_anchor.anchored_at;
END;
$$;

REVOKE ALL ON FUNCTION public.link_evidence_anchor(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_evidence_anchor(UUID) TO authenticated;

-- ── SECTION 4 — what the certificate reads ──────────────────────────────────

-- One row per evidence item, or no row. Kept as a function rather than a view
-- so the participant check is explicit and cannot be lost to a policy edit
-- somewhere else.
CREATE OR REPLACE FUNCTION public.evidence_anchor_for(p_evidence_id UUID)
RETURNS TABLE (
  anchored_at  TIMESTAMPTZ,
  captured_at  TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  -- How long the file existed off-platform. This is the number a reader
  -- actually wants: a small gap is a strong record, a large one is not
  -- disqualifying but should be visible rather than buried.
  held_hours   INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a.anchored_at,
    a.captured_at,
    a.fulfilled_at,
    CASE
      WHEN a.fulfilled_at IS NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM (a.fulfilled_at - a.anchored_at)) / 3600)::INT
    END
  FROM public.evidence_anchors a
  JOIN public.evidence e ON e.id = a.evidence_id
  WHERE a.evidence_id = p_evidence_id
    AND (public.is_case_participant(e.case_id) OR public.is_admin())
  ORDER BY a.anchored_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.evidence_anchor_for(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evidence_anchor_for(UUID) TO authenticated;

-- ── SECTION 5 — anchors still waiting for their bytes ───────────────────────

-- The upload queue's backstop. A device that anchored and then never managed
-- to upload leaves a row here, and this is how the person is reminded that
-- something they recorded is still only on their phone.
CREATE OR REPLACE FUNCTION public.my_pending_anchors()
RETURNS TABLE (
  id          UUID,
  digest      TEXT,
  anchored_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  media_type  TEXT,
  byte_size   BIGINT,
  case_id     UUID
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.digest, a.anchored_at, a.captured_at, a.media_type,
         a.byte_size, a.case_id
  FROM public.evidence_anchors a
  WHERE a.user_id = auth.uid()
    AND a.evidence_id IS NULL
  ORDER BY a.anchored_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.my_pending_anchors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_pending_anchors() TO authenticated;

-- ============================================================================
-- 029 — Time-boxed, revocable evidence grants
-- ============================================================================
--
-- Getting evidence to somebody outside the platform — a lawyer, an insurer, a
-- DPO — has meant downloading it. After that it is a file on someone else's
-- laptop: it cannot be expired, cannot be withdrawn, cannot be counted, and
-- nobody can say who opened it. For material a complainant is handing to an
-- officer they do not entirely trust, that is not a feature, it is a liability.
--
-- A grant replaces the copy with an access right:
--
--   * it expires on its own;
--   * it can be withdrawn at any moment, including after it has been used;
--   * every open is logged into the same custody record the certificate prints;
--   * it is addressed to one named recipient, and the viewer is shown that
--     name across the material while they read it.
--
-- ON THE WATERMARK, PLAINLY. What is implemented here is a VISIBLE overlay
-- naming the recipient, plus a per-view record. It deters the casual forward
-- and it makes a leaked screenshot attributable. It is NOT steganographic and
-- NOT forensic: someone determined, with a second camera or a crop, defeats
-- it. The comments and the interface both say so. The real controls are
-- expiry, revocation and the log — a watermark that was oversold would let
-- someone share material they would otherwise have thought twice about.
--
-- THE TOKEN IS NEVER STORED. Only its SHA-256. A grant link is a bearer
-- credential to criminal case material; a database leak must not hand over
-- working links, and nobody with database access — including us — should be
-- able to read one back out.
-- ============================================================================

-- ── SECTION 1 — the grant ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.evidence_grants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id      UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,

  -- NULL means every exhibit currently on the case. Named deliberately: a
  -- grant is a standing right, so an exhibit added tomorrow is inside a
  -- case-wide grant issued today. Anyone who wants a frozen set names the
  -- exhibit instead, and the interface makes that the default.
  evidence_id  UUID REFERENCES public.evidence(id) ON DELETE CASCADE,

  created_by   UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,

  -- Who it is for. Not an account — the whole point is reaching someone who
  -- does not have one. This is also the text stamped across the material.
  recipient_name  TEXT NOT NULL CHECK (btrim(recipient_name) <> ''),
  recipient_email TEXT,
  -- Why it was issued. Written at the time, when the answer is known, and
  -- read back months later when it is not.
  purpose      TEXT,

  -- SHA-256 of the token, hex. See the header.
  token_hash   TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),

  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  revoked_by   UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,

  -- A ceiling on opens. A grant for one meeting can be set to a handful of
  -- views and stops working afterwards without anyone remembering to revoke it.
  max_views    INT CHECK (max_views IS NULL OR max_views > 0),
  view_count   INT NOT NULL DEFAULT 0,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- An already-expired grant is a mistake, not an intention.
  CONSTRAINT grant_expires_in_the_future CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_evidence_grants_case ON public.evidence_grants(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_grants_creator ON public.evidence_grants(created_by);
CREATE INDEX IF NOT EXISTS idx_evidence_grants_live
  ON public.evidence_grants(expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.evidence_grants ENABLE ROW LEVEL SECURITY;

-- Case participants see the grants on their case. Note there is no policy that
-- exposes `token_hash` selectively — RLS is row-level, not column-level — so
-- the clients read through `case_evidence_grants()` below, which omits it.
DROP POLICY IF EXISTS "Case participants can read grants" ON public.evidence_grants;
CREATE POLICY "Case participants can read grants" ON public.evidence_grants
  FOR SELECT USING (public.is_case_participant(case_id) OR public.is_admin());

REVOKE ALL ON public.evidence_grants FROM anon;
GRANT SELECT ON public.evidence_grants TO authenticated;

-- ── SECTION 2 — the log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.evidence_grant_views (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grant_id    UUID NOT NULL REFERENCES public.evidence_grants(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES public.evidence(id) ON DELETE SET NULL,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- HASHED, NOT STORED. Knowing that two opens came from the same place is
  -- the useful part; keeping the address of a lawyer or an investigating
  -- officer is a liability of its own, and this table would be a map of who
  -- is looking at which case from where.
  ip_hash     TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_grant_views_grant ON public.evidence_grant_views(grant_id, viewed_at DESC);

ALTER TABLE public.evidence_grant_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Case participants can read grant views" ON public.evidence_grant_views;
CREATE POLICY "Case participants can read grant views" ON public.evidence_grant_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.evidence_grants g
      WHERE g.id = grant_id
        AND (public.is_case_participant(g.case_id) OR public.is_admin())
    )
  );

REVOKE ALL ON public.evidence_grant_views FROM anon;
GRANT SELECT ON public.evidence_grant_views TO authenticated;

-- NOTE ON search_path. The three functions below call `gen_random_bytes` and
-- `digest`, which belong to pgcrypto. Supabase installs that extension into the
-- `extensions` schema, so 001's `CREATE EXTENSION IF NOT EXISTS pgcrypto` was a
-- no-op and the functions do not live in `public`. Those functions therefore
-- pin `public, extensions, pg_temp` rather than the usual `public, pg_temp` —
-- still fixed, still not caller-controlled, just pointed at where the extension
-- actually is. Without it every one of them fails with "function does not
-- exist" the first time a grant is issued.

-- ── SECTION 3 — issuing ─────────────────────────────────────────────────────

-- Returns the token exactly once. It is not recoverable afterwards: only the
-- hash is kept, so a lost link is reissued rather than looked up.
CREATE OR REPLACE FUNCTION public.create_evidence_grant(
  p_case_id        UUID,
  p_recipient_name TEXT,
  p_expires_in_hours INT DEFAULT 72,
  p_evidence_id    UUID DEFAULT NULL,
  p_recipient_email TEXT DEFAULT NULL,
  p_purpose        TEXT DEFAULT NULL,
  p_max_views      INT DEFAULT NULL
)
RETURNS TABLE (
  grant_id   UUID,
  token      TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_token   TEXT;
  v_id      UUID;
  v_expires TIMESTAMPTZ;
  v_hours   INT := GREATEST(LEAST(coalesce(p_expires_in_hours, 72), 720), 1);
  v_live    INT;
BEGIN
  IF NOT (public.is_case_participant(p_case_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not a participant in that case';
  END IF;

  IF btrim(coalesce(p_recipient_name, '')) = '' THEN
    -- The name is not decoration; it is what gets stamped on the material and
    -- what the log is worth reading for. An anonymous grant is a copy again.
    RAISE EXCEPTION 'A recipient name is required';
  END IF;

  IF p_evidence_id IS NOT NULL THEN
    PERFORM 1 FROM public.evidence WHERE id = p_evidence_id AND case_id = p_case_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That exhibit is not on that case';
    END IF;
  END IF;

  -- Bounded so a compromised account cannot quietly issue hundreds of live
  -- links to a case before anyone notices.
  SELECT count(*) INTO v_live
  FROM public.evidence_grants
  WHERE case_id = p_case_id AND revoked_at IS NULL AND expires_at > now();

  IF v_live >= 25 THEN
    RAISE EXCEPTION 'Too many active grants on this case. Revoke some first.';
  END IF;

  -- 32 bytes from pgcrypto. Long enough that guessing is not a strategy, and
  -- generated server-side so a client cannot supply a weak one.
  v_token   := encode(gen_random_bytes(32), 'hex');
  v_expires := now() + make_interval(hours => v_hours);

  INSERT INTO public.evidence_grants (
    case_id, evidence_id, created_by, recipient_name, recipient_email,
    purpose, token_hash, expires_at, max_views
  )
  VALUES (
    p_case_id, p_evidence_id, auth.uid(),
    btrim(p_recipient_name), nullif(btrim(coalesce(p_recipient_email, '')), ''),
    nullif(btrim(coalesce(p_purpose, '')), ''),
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expires,
    CASE WHEN p_max_views IS NULL OR p_max_views <= 0 THEN NULL ELSE p_max_views END
  )
  RETURNING id INTO v_id;

  -- Issuing is a custody event. It belongs in the record the certificate
  -- prints, not only in a side table — "who was this shown to" is one of the
  -- first questions anyone asks of a chain of custody.
  IF p_evidence_id IS NOT NULL THEN
    UPDATE public.evidence e
    SET chain_of_custody = e.chain_of_custody || jsonb_build_array(
      jsonb_build_object(
        'timestamp', now(),
        'action', 'access_granted',
        'user_id', auth.uid(),
        'user_name', COALESCE(
          (SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'Unknown'
        ),
        'notes', 'Time-boxed access granted to ' || btrim(p_recipient_name)
                 || ', expiring ' || to_char(v_expires AT TIME ZONE 'UTC',
                                             'YYYY-MM-DD"T"HH24:MI:SS"Z"') || '.'
      )
    )
    WHERE e.id = p_evidence_id;
  END IF;

  RETURN QUERY SELECT v_id, v_token, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_evidence_grant(UUID, TEXT, INT, UUID, TEXT, TEXT, INT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_evidence_grant(UUID, TEXT, INT, UUID, TEXT, TEXT, INT)
  TO authenticated;

-- ── SECTION 4 — withdrawing ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.revoke_evidence_grant(p_grant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.evidence_grants;
BEGIN
  SELECT * INTO v_row FROM public.evidence_grants WHERE id = p_grant_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Grant not found';
  END IF;

  -- Anyone on the case, not only whoever issued it. A complainant who learns
  -- their material is somewhere it should not be must be able to pull the
  -- link immediately, without finding the colleague who created it.
  IF NOT (public.is_case_participant(v_row.case_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not a participant in that case';
  END IF;

  UPDATE public.evidence_grants
  SET revoked_at = now(), revoked_by = auth.uid()
  WHERE id = p_grant_id AND revoked_at IS NULL;

  IF v_row.evidence_id IS NOT NULL THEN
    UPDATE public.evidence e
    SET chain_of_custody = e.chain_of_custody || jsonb_build_array(
      jsonb_build_object(
        'timestamp', now(),
        'action', 'access_revoked',
        'user_id', auth.uid(),
        'user_name', COALESCE(
          (SELECT full_name FROM public.profiles WHERE user_id = auth.uid()), 'Unknown'
        ),
        'notes', 'Access withdrawn for ' || v_row.recipient_name || '.'
      )
    )
    WHERE e.id = v_row.evidence_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_evidence_grant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_evidence_grant(UUID) TO authenticated;

-- ── SECTION 5 — what the case sees ──────────────────────────────────────────

-- Never returns `token_hash`. RLS cannot hide a column, so the read path is a
-- function that does not select it, and the clients use this rather than the
-- table.
CREATE OR REPLACE FUNCTION public.case_evidence_grants(p_case_id UUID)
RETURNS TABLE (
  id              UUID,
  evidence_id     UUID,
  evidence_name   TEXT,
  recipient_name  TEXT,
  recipient_email TEXT,
  purpose         TEXT,
  created_by_name TEXT,
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  max_views       INT,
  view_count      INT,
  last_viewed_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  is_live         BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (public.is_case_participant(p_case_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not a participant in that case';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.evidence_id,
    e.file_name,
    g.recipient_name,
    g.recipient_email,
    g.purpose,
    p.full_name,
    g.expires_at,
    g.revoked_at,
    g.max_views,
    g.view_count,
    (SELECT MAX(v.viewed_at) FROM public.evidence_grant_views v WHERE v.grant_id = g.id),
    g.created_at,
    (g.revoked_at IS NULL
     AND g.expires_at > now()
     AND (g.max_views IS NULL OR g.view_count < g.max_views))
  FROM public.evidence_grants g
  LEFT JOIN public.evidence e ON e.id = g.evidence_id
  LEFT JOIN public.profiles p ON p.user_id = g.created_by
  WHERE g.case_id = p_case_id
  ORDER BY g.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.case_evidence_grants(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_evidence_grants(UUID) TO authenticated;

-- ── SECTION 6 — redeeming, from outside ─────────────────────────────────────

-- Service role only. The caller is the edge function that holds the token from
-- the URL; it is never reachable by a browser, because a browser that could
-- call this could enumerate against it.
--
-- Takes the TOKEN and hashes it here, so the plaintext never has to be
-- compared in application code or logged by an ORM on the way past.
CREATE OR REPLACE FUNCTION public.resolve_evidence_grant(p_token TEXT)
RETURNS TABLE (
  grant_id       UUID,
  case_id        UUID,
  case_title     TEXT,
  evidence_id    UUID,
  recipient_name TEXT,
  purpose        TEXT,
  expires_at     TIMESTAMPTZ,
  views_left     INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN;
  END IF;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  RETURN QUERY
  SELECT
    g.id, g.case_id, c.title, g.evidence_id, g.recipient_name, g.purpose,
    g.expires_at,
    CASE WHEN g.max_views IS NULL THEN NULL
         ELSE GREATEST(g.max_views - g.view_count, 0) END
  FROM public.evidence_grants g
  JOIN public.cases c ON c.id = g.case_id
  WHERE g.token_hash = v_hash
    AND g.revoked_at IS NULL
    AND g.expires_at > now()
    AND (g.max_views IS NULL OR g.view_count < g.max_views);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_evidence_grant(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_evidence_grant(TEXT) TO service_role;

-- What the grant actually opens. Separate from resolve so the edge function
-- validates first and lists second, and so a case-wide grant and a single-
-- exhibit grant have one shape here.
CREATE OR REPLACE FUNCTION public.evidence_for_grant(p_grant_id UUID)
RETURNS TABLE (
  id          UUID,
  file_url    TEXT,
  file_name   TEXT,
  file_type   TEXT,
  file_size   BIGINT,
  file_hash   TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.id, e.file_url, e.file_name, e.file_type, e.file_size,
         e.file_hash, e.description, e.created_at
  FROM public.evidence e
  JOIN public.evidence_grants g ON g.case_id = e.case_id
  WHERE g.id = p_grant_id
    AND g.revoked_at IS NULL
    AND g.expires_at > now()
    -- A grant naming one exhibit opens that one. A grant naming none opens
    -- the case.
    AND (g.evidence_id IS NULL OR g.evidence_id = e.id)
  ORDER BY e.created_at;
$$;

REVOKE ALL ON FUNCTION public.evidence_for_grant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evidence_for_grant(UUID) TO service_role;

-- Counts the open and writes it into the custody record. Called once per
-- viewing session by the edge function, not once per file fetched, or a page
-- with six exhibits would read as six separate accesses.
CREATE OR REPLACE FUNCTION public.record_evidence_grant_view(
  p_grant_id   UUID,
  p_ip         TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_evidence_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_row public.evidence_grants;
BEGIN
  SELECT * INTO v_row FROM public.evidence_grants WHERE id = p_grant_id;
  IF v_row.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.evidence_grant_views (grant_id, evidence_id, ip_hash, user_agent)
  VALUES (
    p_grant_id,
    p_evidence_id,
    -- Salted with the grant id, so the same address under two different grants
    -- does not produce the same hash. Without that, this column would let
    -- anyone reading the table correlate a viewer across unrelated cases.
    CASE WHEN p_ip IS NULL THEN NULL
         ELSE encode(digest(p_grant_id::text || ':' || p_ip, 'sha256'), 'hex') END,
    left(coalesce(p_user_agent, ''), 300)
  );

  UPDATE public.evidence_grants
  SET view_count = view_count + 1
  WHERE id = p_grant_id;

  IF v_row.evidence_id IS NOT NULL THEN
    UPDATE public.evidence e
    SET chain_of_custody = e.chain_of_custody || jsonb_build_array(
      jsonb_build_object(
        'timestamp', now(),
        'action', 'viewed_under_grant',
        -- No user_id: the viewer has no account here. Naming the recipient is
        -- the honest record — it says who the link was issued to, which is
        -- what is actually known, rather than asserting who held it.
        'user_id', NULL,
        'user_name', v_row.recipient_name,
        'notes', 'Opened under a time-boxed access grant.'
      )
    )
    WHERE e.id = v_row.evidence_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_evidence_grant_view(UUID, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_evidence_grant_view(UUID, TEXT, TEXT, UUID)
  TO service_role;

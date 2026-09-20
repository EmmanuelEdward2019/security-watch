-- ============================================================================
-- 027 — Custodian release
-- ============================================================================
--
-- The asymmetry this exists to correct: today, silencing a reporter works.
-- Evidence sits in the platform and surfaces only if the person who filed it
-- keeps pushing. Someone reporting a serving officer, a commander or a
-- politician is therefore safest saying nothing, which is the opposite of what
-- a platform like this should make true.
--
-- A complainant may nominate a CUSTODIAN and a check-in interval. While they
-- keep checking in, nothing happens. If they stop — and stay stopped through a
-- grace period, having been warned — the case and its evidence become readable
-- by that custodian. Harming the reporter now triggers the disclosure instead
-- of preventing it.
--
-- FOUR CONSTRAINTS, EACH LOAD-BEARING. Remove any one and this stops being
-- protection and becomes something else:
--
-- 1. RELEASE IS TO A NAMED, VERIFIED CUSTODIAN. Never to the public, never to
--    a mailing list, never to "the internet". A public dead-man's switch is a
--    blackmail instrument — "settle with me or it goes out" — and it would be
--    used that way here, in exactly the categories this platform covers. The
--    custodian must be a KYC-approved lawyer or investigator on the platform,
--    so a real professional with a real duty is on the other end.
--
-- 2. THE CUSTODIAN MUST CONSENT. Nominating someone imposes an obligation on
--    them. A nomination is a request until they accept it; an unaccepted
--    switch never fires, and the complainant is told so plainly rather than
--    relying on protection that was never agreed.
--
-- 3. THERE IS A GRACE PERIOD AND A WARNING. People lose phones, travel, are
--    admitted to hospital. Firing at the exact deadline would disclose a case
--    file because someone's battery died. The sweep warns first, waits out
--    `grace_days`, and only then releases.
--
-- 4. RELEASE GRANTS READ ACCESS. It does not publish, export, notify the
--    press, or change the case status. The custodian sees what the complainant
--    saw. Everything after that is a human decision by a named professional.
--
-- WHAT IS DELIBERATELY NOT HERE: no automatic release to next of kin (they are
-- not verifiable and not bound by professional duty), and no "release on
-- distress signal" (a duress trigger someone can be forced to press is worse
-- than none — it tells the person applying the force exactly what to demand).
-- ============================================================================

-- ── SECTION 1 — the arrangement ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custodian_releases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  -- Denormalised from the case so ownership checks never need a join, and so
  -- the row still says whose arrangement it was if the case is reassigned.
  owner_id       UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  custodian_id   UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,

  -- What the complainant wants the custodian to know. Read only after a
  -- release; before that it is nobody's business but the author's.
  note_to_custodian TEXT,

  interval_days  INT NOT NULL CHECK (interval_days BETWEEN 1 AND 90),
  grace_days     INT NOT NULL DEFAULT 3 CHECK (grace_days BETWEEN 1 AND 30),

  status         TEXT NOT NULL DEFAULT 'pending_custodian' CHECK (status IN (
    -- Nominated; the custodian has not answered. Never fires in this state.
    'pending_custodian',
    -- Accepted and running.
    'active',
    -- Owner-suspended (travel, hospital, a phone that is gone). Never fires.
    'paused',
    -- The custodian said no. Never fires; the owner is told.
    'declined',
    -- Fired. The custodian can read the case.
    'released',
    -- Owner cancelled, or the case closed.
    'cancelled'
  )),

  last_check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set when the sweep warns the owner that the deadline has passed, so the
  -- grace clock starts from a warning that was actually sent rather than from
  -- a deadline nobody was told about.
  warned_at        TIMESTAMPTZ,
  accepted_at      TIMESTAMPTZ,
  released_at      TIMESTAMPTZ,
  -- The custodian confirming they have seen it. Purely a record; access does
  -- not depend on it.
  acknowledged_at  TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Nominating yourself is not a safeguard, it is a no-op that looks like one.
  CONSTRAINT custodian_is_not_owner CHECK (custodian_id <> owner_id),
  -- One live arrangement per case. Several would race each other on the sweep
  -- and give the owner several check-ins to remember.
  CONSTRAINT one_release_per_case UNIQUE (case_id)
);

CREATE INDEX IF NOT EXISTS idx_custodian_releases_owner ON public.custodian_releases(owner_id);
CREATE INDEX IF NOT EXISTS idx_custodian_releases_custodian ON public.custodian_releases(custodian_id);
-- The sweep's only query.
CREATE INDEX IF NOT EXISTS idx_custodian_releases_due
  ON public.custodian_releases(last_check_in_at)
  WHERE status = 'active';

ALTER TABLE public.custodian_releases ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS custodian_releases_updated_at ON public.custodian_releases;
CREATE TRIGGER custodian_releases_updated_at
  BEFORE UPDATE ON public.custodian_releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Both sides can see the arrangement, and admins can see all of them — an
-- arrangement nobody can audit is not one this platform should host.
DROP POLICY IF EXISTS "Parties can read own custodian releases" ON public.custodian_releases;
CREATE POLICY "Parties can read own custodian releases" ON public.custodian_releases
  FOR SELECT USING (
    auth.uid() = owner_id OR auth.uid() = custodian_id OR public.is_admin()
  );

-- No INSERT, UPDATE or DELETE policy at all. Every transition is an RPC below,
-- because each one has a rule attached — who may make it, and from which state.
REVOKE ALL ON public.custodian_releases FROM anon;
GRANT SELECT ON public.custodian_releases TO authenticated;

-- ── SECTION 2 — who may hold one ────────────────────────────────────────────

-- A custodian receives a criminal case file and is expected to act on it. That
-- is a professional obligation, so the platform will only accept someone it
-- has actually verified.
CREATE OR REPLACE FUNCTION public.is_eligible_custodian(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_user_id
      AND role IN ('lawyer', 'investigator', 'admin')
      AND kyc_status = 'approved'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_eligible_custodian(UUID) TO authenticated;

-- The list a complainant picks from. Name, role and firm only — enough to
-- choose, and nothing that turns this into a directory of professionals'
-- contact details for anyone who signs up.
CREATE OR REPLACE FUNCTION public.eligible_custodians()
RETURNS TABLE (
  user_id      UUID,
  full_name    TEXT,
  role         TEXT,
  service_area TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- `service_area` comes from the professional application where one exists.
  -- LEFT JOIN, not INNER: holding the role with an approved KYC is the
  -- authority here, exactly as `listBookableProfessionals` treats it, and
  -- requiring an `investigators` row would hide lawyers who never filed one.
  SELECT p.user_id, p.full_name, p.role, i.service_area
  FROM public.profiles p
  LEFT JOIN public.investigators i ON i.user_id = p.user_id
  WHERE p.role IN ('lawyer', 'investigator')
    AND p.kyc_status = 'approved'
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.eligible_custodians() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eligible_custodians() TO authenticated;

-- ── SECTION 3 — setting one up ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_custodian_release(
  p_case_id       UUID,
  p_custodian_id  UUID,
  p_interval_days INT DEFAULT 14,
  p_grace_days    INT DEFAULT 3,
  p_note          TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner UUID;
  v_id    UUID;
BEGIN
  SELECT complainant_id INTO v_owner FROM public.cases WHERE id = p_case_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  -- Only the person whose case it is. An assigned investigator arranging
  -- disclosure of their client's file over their head is not a feature.
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Only the complainant can arrange a custodian release';
  END IF;

  IF NOT public.is_eligible_custodian(p_custodian_id) THEN
    RAISE EXCEPTION 'That person cannot act as a custodian';
  END IF;

  INSERT INTO public.custodian_releases (
    case_id, owner_id, custodian_id, note_to_custodian, interval_days, grace_days
  )
  VALUES (
    p_case_id, v_owner, p_custodian_id, nullif(btrim(coalesce(p_note, '')), ''),
    GREATEST(LEAST(coalesce(p_interval_days, 14), 90), 1),
    GREATEST(LEAST(coalesce(p_grace_days, 3), 30), 1)
  )
  RETURNING id INTO v_id;

  -- The custodian is asked, not told. Nothing fires until they accept.
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    p_custodian_id,
    'You have been asked to act as a custodian',
    'A complainant has nominated you to receive a case file if they stop '
    || 'checking in. Review and decide whether to accept.',
    'warning',
    '/app/custodian'
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_custodian_release(UUID, UUID, INT, INT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_custodian_release(UUID, UUID, INT, INT, TEXT)
  TO authenticated;

-- Accepting starts the clock — and resets it, so the interval runs from the
-- moment the arrangement became real rather than from when it was drafted.
CREATE OR REPLACE FUNCTION public.respond_to_custodian_request(
  p_id     UUID,
  p_accept BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.custodian_releases;
BEGIN
  SELECT * INTO v_row FROM public.custodian_releases WHERE id = p_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Arrangement not found';
  END IF;
  IF v_row.custodian_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the nominated custodian can answer this';
  END IF;
  IF v_row.status <> 'pending_custodian' THEN
    RAISE EXCEPTION 'This request has already been answered';
  END IF;

  UPDATE public.custodian_releases
  SET status           = CASE WHEN p_accept THEN 'active' ELSE 'declined' END,
      accepted_at      = CASE WHEN p_accept THEN now() ELSE NULL END,
      last_check_in_at = now()
  WHERE id = p_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_row.owner_id,
    CASE WHEN p_accept THEN 'Your custodian accepted'
         ELSE 'Your custodian declined' END,
    CASE WHEN p_accept
      THEN 'Your safeguard is now active. Check in before each deadline to keep '
           || 'the case file private.'
      -- Said plainly. Someone who believes they are protected and is not is in
      -- more danger than someone who knows they are on their own.
      ELSE 'They did not accept, so no safeguard is in place on that case. '
           || 'Nominate someone else if you still want one.'
    END,
    CASE WHEN p_accept THEN 'success' ELSE 'warning' END,
    '/app/cases/' || v_row.case_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_custodian_request(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_custodian_request(UUID, BOOLEAN) TO authenticated;

-- ── SECTION 4 — staying alive ───────────────────────────────────────────────

-- The whole mechanism, from the owner's side: this one call, before each
-- deadline. Clearing `warned_at` matters — a check-in after a warning must
-- reset the grace clock, or the next lapse would fire early off a stale
-- warning from weeks ago.
CREATE OR REPLACE FUNCTION public.custodian_check_in(p_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  -- No id checks in on everything at once. Someone with three arrangements
  -- should not have to remember three deadlines, and forgetting one is
  -- precisely the failure this feature turns into a disclosure.
  UPDATE public.custodian_releases
  SET last_check_in_at = now(), warned_at = NULL
  WHERE owner_id = auth.uid()
    AND status = 'active'
    AND (p_id IS NULL OR id = p_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.custodian_check_in(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.custodian_check_in(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_custodian_release_status(
  p_id     UUID,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.custodian_releases;
BEGIN
  SELECT * INTO v_row FROM public.custodian_releases WHERE id = p_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Arrangement not found';
  END IF;
  IF v_row.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the complainant can change this';
  END IF;
  IF p_status NOT IN ('active', 'paused', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown status: %', p_status;
  END IF;

  -- A released arrangement is history. Un-releasing it would not take the file
  -- back out of the custodian's head, so pretending otherwise is worse than
  -- refusing.
  IF v_row.status = 'released' THEN
    RAISE EXCEPTION 'This arrangement has already been released';
  END IF;
  IF v_row.status = 'pending_custodian' AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'The custodian has not accepted yet';
  END IF;

  UPDATE public.custodian_releases
  SET status = p_status,
      -- Coming off pause restarts the clock. Resuming into an immediate
      -- release because the interval elapsed while paused would defeat the
      -- point of pausing.
      last_check_in_at = CASE WHEN p_status = 'active' THEN now() ELSE last_check_in_at END,
      warned_at = CASE WHEN p_status = 'active' THEN NULL ELSE warned_at END
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_custodian_release_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_custodian_release_status(UUID, TEXT) TO authenticated;

-- ── SECTION 5 — what release actually grants ────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_released_custodian(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.custodian_releases
    WHERE case_id = p_case_id
      AND custodian_id = auth.uid()
      AND status = 'released'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_released_custodian(UUID) TO authenticated;

-- Additional permissive policies. RLS combines these with OR, so the existing
-- participant rules are untouched — a released custodian simply becomes
-- another way to satisfy the read, and nothing else changes.
DROP POLICY IF EXISTS "Released custodians can read the case" ON public.cases;
CREATE POLICY "Released custodians can read the case" ON public.cases
  FOR SELECT USING (public.is_released_custodian(id));

DROP POLICY IF EXISTS "Released custodians can read evidence" ON public.evidence;
CREATE POLICY "Released custodians can read evidence" ON public.evidence
  FOR SELECT USING (public.is_released_custodian(case_id));

-- Read only, on both. A custodian receives a record; they do not get to edit
-- one, and the chain of custody has to stay true to that.

-- ── SECTION 6 — the sweep ───────────────────────────────────────────────────

-- Deliberately two steps: warn, then release. Anything that fires on the first
-- missed deadline releases case files over flat batteries.
CREATE OR REPLACE FUNCTION public.custodian_releases_due()
RETURNS TABLE (
  id            UUID,
  case_id       UUID,
  owner_id      UUID,
  custodian_id  UUID,
  action        TEXT,
  overdue_hours INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    r.case_id,
    r.owner_id,
    r.custodian_id,
    CASE
      -- Grace is measured from the warning, not from the deadline. If the
      -- warning could not be delivered the clock never starts, which fails
      -- closed: the file stays private.
      WHEN r.warned_at IS NOT NULL
       AND now() > r.warned_at + make_interval(days => r.grace_days)
        THEN 'release'
      ELSE 'warn'
    END AS action,
    EXTRACT(EPOCH FROM (
      now() - (r.last_check_in_at + make_interval(days => r.interval_days))
    ))::INT / 3600 AS overdue_hours
  FROM public.custodian_releases r
  WHERE r.status = 'active'
    AND now() > r.last_check_in_at + make_interval(days => r.interval_days)
    -- Warn once. Repeating it daily would train the owner to ignore exactly
    -- the message that matters most.
    AND (r.warned_at IS NULL
         OR now() > r.warned_at + make_interval(days => r.grace_days))
  ORDER BY r.last_check_in_at;
$$;

REVOKE ALL ON FUNCTION public.custodian_releases_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custodian_releases_due() TO service_role;

CREATE OR REPLACE FUNCTION public.mark_custodian_release_warned(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.custodian_releases;
BEGIN
  UPDATE public.custodian_releases
  SET warned_at = now()
  WHERE id = p_id AND status = 'active' AND warned_at IS NULL
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RETURN; END IF;

  -- Unambiguous on purpose. This is not a reminder to engage with the app; it
  -- is the last thing standing between a private case file and disclosure.
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_row.owner_id,
    'Check in to keep your case private',
    'You have missed a check-in. If you do not check in within '
    || v_row.grace_days || ' day' || CASE WHEN v_row.grace_days = 1 THEN '' ELSE 's' END
    || ', this case will be released to the custodian you nominated.',
    'warning',
    '/app/cases/' || v_row.case_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_custodian_release_warned(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_custodian_release_warned(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.execute_custodian_release(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.custodian_releases;
BEGIN
  -- Re-checks the condition inside the transaction rather than trusting the
  -- sweep's earlier read. A check-in landing between the two must win: the
  -- whole design is that checking in prevents this.
  UPDATE public.custodian_releases
  SET status = 'released', released_at = now()
  WHERE id = p_id
    AND status = 'active'
    AND warned_at IS NOT NULL
    AND now() > warned_at + make_interval(days => grace_days)
    AND now() > last_check_in_at + make_interval(days => interval_days)
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_row.custodian_id,
    'A case has been released to you',
    'A complainant who nominated you has stopped checking in. Their case file '
    || 'and its evidence are now readable by you.',
    'warning',
    '/app/custodian'
  );

  -- The owner is told too. If they are simply out of contact rather than in
  -- trouble, this is how they find out — and they may still be reachable.
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_row.owner_id,
    'Your case was released to your custodian',
    'Check-ins lapsed past the grace period, so the safeguard you set up has '
    || 'run. Your custodian can now read this case.',
    'warning',
    '/app/cases/' || v_row.case_id::text
  );

  -- Administrators must be able to see that this happened. A mechanism that
  -- discloses case files with no operational record would be indefensible.
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    v_row.owner_id,
    'custodian_release_executed',
    'cases',
    v_row.case_id::text,
    jsonb_build_object(
      'release_id', v_row.id,
      'custodian_id', v_row.custodian_id,
      'interval_days', v_row.interval_days,
      'grace_days', v_row.grace_days,
      'last_check_in_at', v_row.last_check_in_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_custodian_release(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_custodian_release(UUID) TO service_role;

-- ── SECTION 7 — the custodian's own view ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.acknowledge_custodian_release(p_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.custodian_releases
  SET acknowledged_at = now()
  WHERE id = p_id AND custodian_id = auth.uid() AND status = 'released';
$$;

REVOKE ALL ON FUNCTION public.acknowledge_custodian_release(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_custodian_release(UUID) TO authenticated;

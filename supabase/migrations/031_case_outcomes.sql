-- ============================================================================
-- 031 — Case outcomes and the accountability ledger
-- ============================================================================
--
-- `cases.status` ends at 'completed' or 'closed' and says nothing about what
-- actually happened. A case that ended in a conviction and a case that was
-- abandoned because nobody would take the file are indistinguishable in the
-- record — which means the platform cannot answer the only question that
-- matters to anyone deciding whether to report at all: does this work?
--
-- Recording the outcome makes that answerable. Aggregating it makes the
-- platform something more than a service: which commands resolve matters, how
-- long they take, and which categories go nowhere is the civic dividend of
-- having collected any of this, and it is the part that draws press, donors
-- and the political cover a platform like this eventually needs.
--
-- TWO RULES ON THE PUBLIC FIGURES, BOTH LOAD-BEARING:
--
-- 1. SMALL CELLS ARE SUPPRESSED. "One murder case in Bayelsa, unresolved" is
--    not a statistic, it is a person, and in a small state with a single
--    reported case it identifies them to anyone who knows the matter. Every
--    public aggregate below hides any group with fewer than five cases in it.
--
-- 2. INSTITUTIONS ARE NAMED, PEOPLE ARE NOT. The point is to hold commands and
--    agencies to account. No public figure carries a case id, a complainant, a
--    professional, a title or a date more precise than a month.
-- ============================================================================

-- ── SECTION 1 — what happened ───────────────────────────────────────────────

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS outcome TEXT
    CHECK (outcome IS NULL OR outcome IN (
      -- The matter was settled to the complainant's satisfaction.
      'resolved',
      -- Handed to the police or another agency, and they took it.
      'referred_accepted',
      -- Handed over and refused, or never acknowledged. The single most
      -- important value in this list: it is the failure the platform exists to
      -- make visible, and without its own value it would be recorded as
      -- 'unresolved' and vanish into the noise.
      'referred_refused',
      -- A charge was actually laid.
      'prosecution_commenced',
      'conviction',
      'acquittal',
      -- The complainant chose to stop.
      'withdrawn',
      -- Everything was tried and nothing could be done.
      'no_action_possible',
      -- Still open, nothing moving. Recorded honestly rather than left blank.
      'stalled',
      'duplicate'
    )),
  ADD COLUMN IF NOT EXISTS outcome_note TEXT,
  ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_recorded_by UUID
    REFERENCES public.profiles(user_id) ON DELETE SET NULL,

  -- Which body handled it, as free text plus an optional link to the
  -- institutions table. Free text because a complainant knows "Ojodu Division"
  -- and not an id, and a scorecard nobody can populate scores nothing.
  ADD COLUMN IF NOT EXISTS handling_institution TEXT,
  ADD COLUMN IF NOT EXISTS handling_institution_id UUID
    REFERENCES public.institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handling_state TEXT;

CREATE INDEX IF NOT EXISTS idx_cases_outcome
  ON public.cases(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_handling_institution
  ON public.cases(handling_institution) WHERE handling_institution IS NOT NULL;

-- The outcome is a finding about an institution's conduct, so it must not be
-- self-writable by anybody who feels strongly about it. Pinned by the same
-- guard-trigger pattern 004 established: the columns stand down only inside a
-- transaction an RPC has elevated.
CREATE OR REPLACE FUNCTION public.guard_case_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.tsw_is_elevated() THEN
    RETURN NEW;
  END IF;

  IF NEW.outcome IS DISTINCT FROM OLD.outcome
     OR NEW.handling_institution IS DISTINCT FROM OLD.handling_institution
     OR NEW.outcome_recorded_by IS DISTINCT FROM OLD.outcome_recorded_by THEN
    PERFORM public.log_guard_violation(
      'cases',
      OLD.id::text,
      jsonb_build_object(
        'attempted_outcome', NEW.outcome,
        'current_outcome', OLD.outcome,
        'attempted_institution', NEW.handling_institution
      )
    );
  END IF;

  NEW.outcome                 := OLD.outcome;
  NEW.outcome_note            := OLD.outcome_note;
  NEW.outcome_recorded_at     := OLD.outcome_recorded_at;
  NEW.outcome_recorded_by     := OLD.outcome_recorded_by;
  NEW.handling_institution    := OLD.handling_institution;
  NEW.handling_institution_id := OLD.handling_institution_id;
  NEW.handling_state          := OLD.handling_state;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_guard_outcome ON public.cases;
CREATE TRIGGER cases_guard_outcome
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_case_outcome();

REVOKE ALL ON FUNCTION public.guard_case_outcome() FROM PUBLIC, anon, authenticated;

-- ── SECTION 2 — recording it ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_case_outcome(
  p_case_id     UUID,
  p_outcome     TEXT,
  p_note        TEXT DEFAULT NULL,
  p_institution TEXT DEFAULT NULL,
  p_state       TEXT DEFAULT NULL,
  p_institution_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_case public.cases;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  IF v_case.id IS NULL THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  -- An administrator, or a professional actually assigned to the case. A
  -- complainant does not record the outcome of their own matter: this figure
  -- is meant to be citable, and self-reported success is not.
  IF NOT (
    public.is_admin()
    OR auth.uid() = v_case.assigned_investigator_id
    OR auth.uid() = v_case.assigned_lawyer_id
    OR auth.uid() = v_case.assigned_expert_id
  ) THEN
    RAISE EXCEPTION 'Only an administrator or an assigned professional can record an outcome';
  END IF;

  IF p_outcome NOT IN (
    'resolved','referred_accepted','referred_refused','prosecution_commenced',
    'conviction','acquittal','withdrawn','no_action_possible','stalled','duplicate'
  ) THEN
    RAISE EXCEPTION 'Unknown outcome: %', p_outcome;
  END IF;

  PERFORM public.tsw_elevate();

  UPDATE public.cases
  SET outcome                 = p_outcome,
      outcome_note            = nullif(btrim(coalesce(p_note, '')), ''),
      outcome_recorded_at     = now(),
      outcome_recorded_by     = auth.uid(),
      handling_institution    = nullif(btrim(coalesce(p_institution, '')), ''),
      handling_institution_id = p_institution_id,
      handling_state          = nullif(btrim(coalesce(p_state, '')), '')
  WHERE id = p_case_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(), 'case_outcome_recorded', 'cases', p_case_id::text,
    jsonb_build_object(
      'outcome', p_outcome,
      'institution', p_institution,
      'state', p_state,
      'previous_outcome', v_case.outcome
    )
  );

  -- The complainant is told. An outcome recorded on someone's case without
  -- telling them is a record kept about a person rather than for them.
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_case.complainant_id,
    'An outcome was recorded on your case',
    'The result of your case has been entered on the record. Open it to read '
    || 'what was recorded and by whom.',
    CASE WHEN p_outcome IN ('resolved','conviction','referred_accepted',
                            'prosecution_commenced')
         THEN 'success' ELSE 'info' END,
    '/app/cases/' || p_case_id::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_case_outcome(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_case_outcome(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO authenticated;

-- ── SECTION 3 — the admin ledger ────────────────────────────────────────────

-- Unsuppressed, because an administrator can already read every case. This is
-- the operational view: what is being recorded, and what is not.
CREATE OR REPLACE FUNCTION public.admin_outcome_ledger(p_days INT DEFAULT 365)
RETURNS TABLE (
  category          TEXT,
  outcome           TEXT,
  cases             INT,
  median_days       NUMERIC,
  institutions      INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  RETURN QUERY
  SELECT
    c.category,
    COALESCE(c.outcome, 'not_recorded'),
    COUNT(*)::INT,
    -- Median, not mean. One case that ran for three years would drag an
    -- average somewhere useless, and the typical wait is the number anyone
    -- deciding whether to report actually wants.
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (
        COALESCE(c.outcome_recorded_at, now()) - c.created_at
      )) / 86400
    )::NUMERIC, 1),
    COUNT(DISTINCT c.handling_institution)::INT
  FROM public.cases c
  WHERE c.created_at > now() - make_interval(days => GREATEST(LEAST(coalesce(p_days, 365), 3650), 1))
  GROUP BY c.category, COALESCE(c.outcome, 'not_recorded')
  ORDER BY COUNT(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_outcome_ledger(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_outcome_ledger(INT) TO authenticated;

-- Per-institution, for administrators. This is the scorecard in its raw form,
-- before any suppression, and it is the thing that should be checked before
-- any figure is published.
CREATE OR REPLACE FUNCTION public.admin_institution_scorecard(p_days INT DEFAULT 365)
RETURNS TABLE (
  institution   TEXT,
  state         TEXT,
  cases         INT,
  accepted      INT,
  refused       INT,
  resolved      INT,
  median_days   NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  RETURN QUERY
  SELECT
    c.handling_institution,
    c.handling_state,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE c.outcome = 'referred_accepted')::INT,
    COUNT(*) FILTER (WHERE c.outcome = 'referred_refused')::INT,
    COUNT(*) FILTER (WHERE c.outcome IN ('resolved','conviction',
                                         'prosecution_commenced'))::INT,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (
        COALESCE(c.outcome_recorded_at, now()) - c.created_at
      )) / 86400
    )::NUMERIC, 1)
  FROM public.cases c
  WHERE c.handling_institution IS NOT NULL
    AND c.created_at > now() - make_interval(days => GREATEST(LEAST(coalesce(p_days, 365), 3650), 1))
  GROUP BY c.handling_institution, c.handling_state
  ORDER BY COUNT(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_institution_scorecard(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_institution_scorecard(INT) TO authenticated;

-- ── SECTION 4 — the public figures ──────────────────────────────────────────

-- The suppression floor. Five is the conventional minimum cell size for
-- published crime statistics, and it is the difference between a figure and a
-- disclosure.
CREATE OR REPLACE FUNCTION public.tsw_min_cell()
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$ SELECT 5; $$;

-- Anon-readable. No case ids, no titles, no dates finer than a month, and
-- nothing at all for any group smaller than the floor.
CREATE OR REPLACE FUNCTION public.public_outcome_summary(p_months INT DEFAULT 12)
RETURNS TABLE (
  category      TEXT,
  cases         INT,
  resolved      INT,
  referred_out  INT,
  no_action     INT,
  still_open    INT,
  median_days   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.category,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE c.outcome IN ('resolved','conviction'))::INT,
    COUNT(*) FILTER (WHERE c.outcome IN ('referred_accepted','referred_refused',
                                         'prosecution_commenced'))::INT,
    COUNT(*) FILTER (WHERE c.outcome IN ('no_action_possible','withdrawn'))::INT,
    COUNT(*) FILTER (WHERE c.outcome IS NULL OR c.outcome = 'stalled')::INT,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (
        COALESCE(c.outcome_recorded_at, now()) - c.created_at
      )) / 86400
    )::NUMERIC, 1)
  FROM public.cases c
  WHERE c.created_at > now() - make_interval(
          months => GREATEST(LEAST(coalesce(p_months, 12), 120), 1))
  GROUP BY c.category
  -- The suppression. A category with four cases in it is withheld entirely
  -- rather than rounded, because rounding a count of four still tells you
  -- there were some.
  HAVING COUNT(*) >= public.tsw_min_cell()
  ORDER BY COUNT(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.public_outcome_summary(INT) TO anon, authenticated;

-- The institution scorecard, published.
--
-- NOTE THE JOIN. This reports on `handling_institution_id` and prints the
-- institution's CANONICAL name from the curated `institutions` table — never
-- `handling_institution`, the free-text field.
--
-- That is not tidiness, it is the disclosure control. The free-text field is
-- typed by whoever recorded the outcome, and somebody will eventually write
-- "Sgt. Adeyemi at Ojodu" in it. Publishing that column would put a named
-- officer into an anonymous public dataset, from a platform whose whole
-- premise is that reporting is safe. Linking the case to a curated institution
-- is therefore a deliberate act with an id attached, and only linked cases are
-- ever published.
--
-- Same suppression floor as everything else here, and the median rounded to
-- whole days — one decimal place on six cases is false precision that invites
-- over-reading.
CREATE OR REPLACE FUNCTION public.public_institution_scorecard(p_months INT DEFAULT 12)
RETURNS TABLE (
  institution   TEXT,
  state         TEXT,
  cases         INT,
  accepted      INT,
  refused       INT,
  median_days   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    i.name,
    i.location,
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE c.outcome = 'referred_accepted')::INT,
    COUNT(*) FILTER (WHERE c.outcome = 'referred_refused')::INT,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (
        COALESCE(c.outcome_recorded_at, now()) - c.created_at
      )) / 86400
    )::NUMERIC, 0)
  FROM public.cases c
  JOIN public.institutions i ON i.id = c.handling_institution_id
  WHERE c.outcome IS NOT NULL
    AND c.created_at > now() - make_interval(
          months => GREATEST(LEAST(coalesce(p_months, 12), 120), 1))
  GROUP BY i.id, i.name, i.location
  HAVING COUNT(*) >= public.tsw_min_cell()
  ORDER BY COUNT(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.public_institution_scorecard(INT) TO anon, authenticated;

COMMENT ON COLUMN public.cases.handling_institution IS
  'Free text, entered by whoever recorded the outcome. NEVER published — it can contain a person''s name. Public figures use handling_institution_id and the curated institutions table.';

COMMENT ON COLUMN public.cases.handling_institution_id IS
  'Link to the curated institutions table. Only cases linked here appear in public_institution_scorecard().';

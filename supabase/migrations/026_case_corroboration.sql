-- ============================================================================
-- 026 — Corroboration by proximity
-- ============================================================================
--
-- Every case has been an island. `cases` has carried `latitude`, `longitude`
-- and `category` since 001 and nothing has ever joined them, so three strangers
-- reporting the same armed robbery produced three weak files instead of one
-- corroborated incident.
--
-- Independence is the point. A single account, however detailed, is one
-- person's word. Two strangers who do not know each other, reporting the same
-- thing in the same place at the same hour, is a different class of evidence —
-- and it is the one property a lone report can never acquire no matter how good
-- the photographs are.
--
-- WHAT THIS MUST NOT DO. Cases are confidential and RLS keeps them that way. A
-- complainant asking "did anyone else see this" must never be handed another
-- complainant's title, description, name or case id — in a land dispute or a
-- domestic matter, telling one party that a neighbour also filed identifies the
-- neighbour. So there are two functions here with deliberately different
-- shapes:
--
--   * `case_corroboration` — for a case participant. Counts, distances, times
--     and categories. No identifiers of any kind, ever.
--   * `admin_corroboration_clusters` — for administrators, who can already read
--     every case. Full detail, because acting on a cluster requires knowing
--     which cases are in it.
--
-- SELF-CORROBORATION IS EXCLUDED. Reports from the same complainant do not
-- corroborate each other. Without that rule the feature is a machine for
-- manufacturing credibility out of one person filing five times.
-- ============================================================================

-- ── SECTION 1 — when it happened, as distinct from when it was filed ────────

-- Clustering on `created_at` clusters on when someone got to their phone, not
-- on when the thing happened. Those differ by hours for anyone who had to get
-- somewhere safe first, and by days for anyone who had to be persuaded to
-- report at all — which is most people, in most of these categories.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

COMMENT ON COLUMN public.cases.occurred_at IS
  'When the incident happened, as reported. NULL falls back to created_at. Clustering uses this.';

-- Backfill is a no-op statement rather than a data write: an existing row has
-- no better answer than its filing time, and COALESCE at read time says so
-- honestly instead of inventing a precision the record does not have.
CREATE INDEX IF NOT EXISTS idx_cases_occurred_at
  ON public.cases(COALESCE(occurred_at, created_at) DESC);

-- The geo index the neighbour search leans on. Partial, because a case without
-- coordinates can never be a neighbour and there are a lot of them.
CREATE INDEX IF NOT EXISTS idx_cases_geo
  ON public.cases(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── SECTION 2 — which categories can describe the same event ────────────────

-- A robbery and an assault reported on the same street within the hour are
-- very often one incident described by two people who noticed different parts
-- of it. Insisting on an exact category match would miss precisely the
-- corroboration that matters most.
--
-- IMMUTABLE so it can be used inside index expressions and inlined in joins.
CREATE OR REPLACE FUNCTION public.case_category_family(p_category TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_category
    -- One event, several vantage points. `missing_person` belongs here because
    -- a person reported missing near a reported kidnapping is the single most
    -- operationally useful link this table can produce.
    WHEN 'robbery'         THEN 'violent'
    WHEN 'assault'         THEN 'violent'
    WHEN 'murder'          THEN 'violent'
    WHEN 'kidnapping'      THEN 'violent'
    WHEN 'missing_person'  THEN 'violent'

    WHEN 'fraud'           THEN 'financial'
    WHEN 'cybercrime'      THEN 'financial'
    WHEN 'corruption'      THEN 'financial'

    WHEN 'land_dispute'    THEN 'dispute'
    WHEN 'domestic_dispute' THEN 'dispute'

    ELSE 'other'
  END;
$$;

-- ── SECTION 3 — what a complainant may see ──────────────────────────────────

-- Returns one row. Everything in it is an aggregate; nothing in it can be
-- traced to a person. `direct_matches` counts the same category, `related_
-- matches` the same family, and both exclude this case's own complainant.
CREATE OR REPLACE FUNCTION public.case_corroboration(
  p_case_id      UUID,
  p_radius_km    NUMERIC DEFAULT 2,
  p_window_hours INT DEFAULT 24
)
RETURNS TABLE (
  direct_matches     INT,
  related_matches    INT,
  nearest_km         NUMERIC,
  first_report_at    TIMESTAMPTZ,
  last_report_at     TIMESTAMPTZ,
  radius_km          NUMERIC,
  window_hours       INT,
  has_coordinates    BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lat      NUMERIC;
  v_lon      NUMERIC;
  v_at       TIMESTAMPTZ;
  v_category TEXT;
  v_owner    UUID;
  v_radius   NUMERIC := GREATEST(LEAST(coalesce(p_radius_km, 2), 25), 0.1);
  v_window   INT     := GREATEST(LEAST(coalesce(p_window_hours, 24), 168), 1);
BEGIN
  -- SECURITY DEFINER bypasses RLS, so the participant check is the whole
  -- access control for this function and must come first.
  IF NOT (public.is_case_participant(p_case_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not a participant in that case';
  END IF;

  SELECT c.latitude, c.longitude, COALESCE(c.occurred_at, c.created_at),
         c.category, c.complainant_id
    INTO v_lat, v_lon, v_at, v_category, v_owner
  FROM public.cases c
  WHERE c.id = p_case_id;

  IF v_lat IS NULL OR v_lon IS NULL THEN
    -- No coordinates, no neighbours. Returning a row of zeros with the flag
    -- set lets the interface say "add a location to see this" rather than
    -- showing a bare zero that reads as "nobody else reported it".
    RETURN QUERY SELECT 0, 0, NULL::NUMERIC, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ,
                        v_radius, v_window, false;
    RETURN;
  END IF;

  RETURN QUERY
  WITH bounds AS (
    SELECT
      v_lat - (v_radius / 111.0)                                AS min_lat,
      v_lat + (v_radius / 111.0)                                AS max_lat,
      v_lon - (v_radius / (111.0 * COS(RADIANS(v_lat))))        AS min_lon,
      v_lon + (v_radius / (111.0 * COS(RADIANS(v_lat))))        AS max_lon
  ),
  neighbours AS (
    SELECT
      c.category,
      COALESCE(c.occurred_at, c.created_at) AS at,
      (6371 * ACOS(
        LEAST(1, GREATEST(-1,
          COS(RADIANS(v_lat)) * COS(RADIANS(c.latitude))
          * COS(RADIANS(c.longitude) - RADIANS(v_lon))
          + SIN(RADIANS(v_lat)) * SIN(RADIANS(c.latitude))
        ))
      ))::NUMERIC AS distance_km
    FROM public.cases c, bounds b
    WHERE c.id <> p_case_id
      -- The independence rule. Without it, one person filing repeatedly
      -- corroborates themselves.
      AND c.complainant_id <> v_owner
      AND c.latitude IS NOT NULL
      AND c.longitude IS NOT NULL
      AND c.latitude BETWEEN b.min_lat AND b.max_lat
      AND c.longitude BETWEEN b.min_lon AND b.max_lon
      AND COALESCE(c.occurred_at, c.created_at)
            BETWEEN v_at - make_interval(hours => v_window)
                AND v_at + make_interval(hours => v_window)
      AND public.case_category_family(c.category) = public.case_category_family(v_category)
  ),
  within AS (
    SELECT * FROM neighbours WHERE distance_km <= v_radius
  )
  SELECT
    COUNT(*) FILTER (WHERE category = v_category)::INT,
    COUNT(*) FILTER (WHERE category <> v_category)::INT,
    ROUND(MIN(distance_km), 2),
    MIN(at),
    MAX(at),
    v_radius,
    v_window,
    true
  FROM within;
END;
$$;

REVOKE ALL ON FUNCTION public.case_corroboration(UUID, NUMERIC, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_corroboration(UUID, NUMERIC, INT) TO authenticated;

-- ── SECTION 4 — what an administrator may see ───────────────────────────────

-- Administrators can already read every case, so there is nothing to withhold;
-- what they lack is the join. This lists recent cases that have at least one
-- independent neighbour, heaviest cluster first — an incident board rather
-- than a case list.
CREATE OR REPLACE FUNCTION public.admin_corroboration_clusters(
  p_days         INT DEFAULT 30,
  p_radius_km    NUMERIC DEFAULT 2,
  p_window_hours INT DEFAULT 24,
  p_limit        INT DEFAULT 50
)
RETURNS TABLE (
  case_id          UUID,
  title            TEXT,
  category         TEXT,
  urgency          TEXT,
  status           TEXT,
  location         TEXT,
  latitude         NUMERIC,
  longitude        NUMERIC,
  occurred_at      TIMESTAMPTZ,
  corroborations   INT,
  distinct_reporters INT,
  nearest_km       NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days   INT     := GREATEST(LEAST(coalesce(p_days, 30), 365), 1);
  v_radius NUMERIC := GREATEST(LEAST(coalesce(p_radius_km, 2), 25), 0.1);
  v_window INT     := GREATEST(LEAST(coalesce(p_window_hours, 24), 168), 1);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT c.id, c.title, c.category, c.urgency, c.status, c.location,
           c.latitude, c.longitude, c.complainant_id,
           COALESCE(c.occurred_at, c.created_at) AS at
    FROM public.cases c
    WHERE c.latitude IS NOT NULL
      AND c.longitude IS NOT NULL
      AND COALESCE(c.occurred_at, c.created_at) > now() - make_interval(days => v_days)
  ),
  paired AS (
    SELECT
      a.id, a.title, a.category, a.urgency, a.status, a.location,
      a.latitude, a.longitude, a.at,
      b.complainant_id AS other_reporter,
      (6371 * ACOS(
        LEAST(1, GREATEST(-1,
          COS(RADIANS(a.latitude)) * COS(RADIANS(b.latitude))
          * COS(RADIANS(b.longitude) - RADIANS(a.longitude))
          + SIN(RADIANS(a.latitude)) * SIN(RADIANS(b.latitude))
        ))
      ))::NUMERIC AS distance_km
    FROM recent a
    JOIN recent b
      ON b.id <> a.id
     AND b.complainant_id <> a.complainant_id
     AND public.case_category_family(b.category) = public.case_category_family(a.category)
     AND b.at BETWEEN a.at - make_interval(hours => v_window)
                  AND a.at + make_interval(hours => v_window)
     -- Bounding box before haversine, so the index does the elimination.
     AND b.latitude  BETWEEN a.latitude  - (v_radius / 111.0)
                         AND a.latitude  + (v_radius / 111.0)
     AND b.longitude BETWEEN a.longitude - (v_radius / (111.0 * COS(RADIANS(a.latitude))))
                         AND a.longitude + (v_radius / (111.0 * COS(RADIANS(a.latitude))))
  )
  SELECT
    p.id, p.title, p.category, p.urgency, p.status, p.location,
    p.latitude, p.longitude, p.at,
    COUNT(*)::INT,
    -- The number that matters. Ten reports from two people is a dispute;
    -- three reports from three people is an incident.
    COUNT(DISTINCT p.other_reporter)::INT,
    ROUND(MIN(p.distance_km), 2)
  FROM paired p
  WHERE p.distance_km <= v_radius
  GROUP BY p.id, p.title, p.category, p.urgency, p.status, p.location,
           p.latitude, p.longitude, p.at
  ORDER BY COUNT(DISTINCT p.other_reporter) DESC, COUNT(*) DESC, p.at DESC
  LIMIT GREATEST(LEAST(p_limit, 200), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_corroboration_clusters(INT, NUMERIC, INT, INT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_corroboration_clusters(INT, NUMERIC, INT, INT)
  TO authenticated;

-- ── SECTION 5 — keeping occurred_at honest ──────────────────────────────────

-- `occurred_at` is client-writable (guard_cases pins only the trust-bearing
-- columns, and this is not one). That is fine for a date somebody types, but
-- clustering is only as good as its time axis: a future date, or one from
-- 1970 because a device clock was wrong, drags a case into windows it has no
-- business being in.
--
-- A CHECK constraint cannot express this — `now()` is not IMMUTABLE and
-- Postgres refuses it — so it is a trigger. Out-of-range values are nulled
-- rather than rejected: refusing the write would lose the whole report over a
-- mistyped date, and NULL falls back to `created_at`, which is the honest
-- answer when the stated time cannot be believed.
CREATE OR REPLACE FUNCTION public.clamp_case_occurred_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.occurred_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- A little tolerance ahead of now absorbs device clock skew without
  -- admitting genuinely future dates.
  IF NEW.occurred_at > now() + INTERVAL '1 hour'
     OR NEW.occurred_at < now() - INTERVAL '25 years' THEN
    NEW.occurred_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_clamp_occurred_at ON public.cases;
CREATE TRIGGER cases_clamp_occurred_at
  BEFORE INSERT OR UPDATE OF occurred_at ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.clamp_case_occurred_at();

-- Trigger functions are never called directly (017).
REVOKE ALL ON FUNCTION public.clamp_case_occurred_at() FROM PUBLIC, anon, authenticated;

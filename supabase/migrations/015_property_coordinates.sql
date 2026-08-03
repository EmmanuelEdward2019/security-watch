-- =============================================================================
-- 015 — PROPERTY COORDINATES
-- =============================================================================
-- `cases` has latitude and longitude; `properties` never did. The mobile team
-- hit this building the listing form: they can reverse-geocode a device fix into
-- the address text, but there is nowhere to put the fix itself, so it is
-- discarded.
--
-- That loss is not recoverable. Re-deriving coordinates from an address string
-- later is a geocode of a geocode — it lands on the street centroid rather than
-- the building, and fails outright for the unmapped addresses that are common
-- outside major Nigerian cities. The device already knew the answer; we were
-- throwing it away.
--
-- Additive and nullable, so nothing existing breaks. `properties` holds 0 rows
-- (verified 3 August 2026), so there is nothing to backfill.
--
-- Unblocks: map view, "near me" search, distance sort, and giving a verification
-- inspector a coordinate to navigate to rather than a text address.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — The columns
-- =============================================================================
-- numeric, matching `cases`, rather than PostGIS. The queries this platform
-- needs are bounding-box and haversine, both of which numeric handles. Adopting
-- PostGIS for that would be a large dependency for no gain — revisit it if
-- polygon search or routing is ever required.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

COMMENT ON COLUMN public.properties.latitude IS
  'Device or geocoded fix for the listing. Nullable: a listing is still valid '
  'without one, and geocoding fails for many rural Nigerian addresses.';

-- Sanity bounds. A transposed lat/long is the classic mistake here and would
-- otherwise place a Lagos property in the Atlantic without complaint.
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_latitude_range;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_latitude_range
  CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90));

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_longitude_range;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_longitude_range
  CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180));

-- Supports the bounding-box filter a map viewport produces.
CREATE INDEX IF NOT EXISTS idx_properties_coordinates
  ON public.properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_active;


-- =============================================================================
-- SECTION 2 — Nearby search
-- =============================================================================
-- Provided so the clients do not each implement haversine over a full table
-- pull, which is the obvious wrong turn: it would mean shipping every listing to
-- the device to sort a handful.
--
-- The bounding box runs first and uses the index; haversine then refines only
-- the rows that survive it.
--
-- Deliberately callable by anon: the marketplace is a public, pre-login surface
-- and RLS still restricts rows to active listings.

CREATE OR REPLACE FUNCTION public.properties_nearby(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_radius_km NUMERIC DEFAULT 10,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  property_type TEXT,
  listing_type TEXT,
  price NUMERIC,
  currency TEXT,
  location TEXT,
  address TEXT,
  bedrooms INT,
  bathrooms INT,
  area_sqm NUMERIC,
  status TEXT,
  images TEXT[],
  latitude NUMERIC,
  longitude NUMERIC,
  distance_km NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH bounds AS (
    SELECT
      -- One degree of latitude is ~111 km everywhere. Longitude narrows toward
      -- the poles, so it is scaled by cos(latitude) — at Nigeria's latitudes
      -- that is a meaningful difference, not a rounding detail.
      p_latitude  - (p_radius_km / 111.0)                                    AS min_lat,
      p_latitude  + (p_radius_km / 111.0)                                    AS max_lat,
      p_longitude - (p_radius_km / (111.0 * COS(RADIANS(p_latitude))))       AS min_lon,
      p_longitude + (p_radius_km / (111.0 * COS(RADIANS(p_latitude))))       AS max_lon
  )
  SELECT
    p.id, p.title, p.description, p.property_type, p.listing_type,
    p.price, p.currency, p.location, p.address,
    p.bedrooms, p.bathrooms, p.area_sqm, p.status, p.images,
    p.latitude, p.longitude,
    ROUND(
      (6371 * ACOS(
        LEAST(1, GREATEST(-1,
          COS(RADIANS(p_latitude)) * COS(RADIANS(p.latitude))
          * COS(RADIANS(p.longitude) - RADIANS(p_longitude))
          + SIN(RADIANS(p_latitude)) * SIN(RADIANS(p.latitude))
        ))
      ))::numeric, 2
    ) AS distance_km,
    p.created_at
  FROM public.properties p, bounds b
  WHERE p.is_active
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND p.latitude BETWEEN b.min_lat AND b.max_lat
    AND p.longitude BETWEEN b.min_lon AND b.max_lon
    AND (6371 * ACOS(
          LEAST(1, GREATEST(-1,
            COS(RADIANS(p_latitude)) * COS(RADIANS(p.latitude))
            * COS(RADIANS(p.longitude) - RADIANS(p_longitude))
            + SIN(RADIANS(p_latitude)) * SIN(RADIANS(p.latitude))
          ))
        )) <= p_radius_km
  ORDER BY distance_km, p.status DESC
  LIMIT GREATEST(LEAST(p_limit, 200), 1);
$$;

GRANT EXECUTE ON FUNCTION public.properties_nearby(NUMERIC, NUMERIC, NUMERIC, INT)
  TO anon, authenticated;


-- =============================================================================
-- SECTION 3 — Note on exposure, for whoever reads this next
-- =============================================================================
-- These coordinates are readable by anyone, because `properties` rows are
-- public while is_active. That is consistent with the full street address
-- already being public on the same row, so it adds no meaningful exposure — and
-- a marketplace where buyers cannot see where a property is would not work.
--
-- If a future requirement calls for coarse public location and exact
-- coordinates only for the owner and admins, do NOT drop these columns. Add a
-- rounded pair for public consumption and move the precise ones behind a
-- SECURITY DEFINER function, so the precision is still captured at the point the
-- device knows it.

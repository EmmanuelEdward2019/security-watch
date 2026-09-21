-- ============================================================================
-- 033 — An address beside every coordinate, and a broken submission fixed
-- ============================================================================
--
-- `cases` and `properties` have carried a human-readable `location` since 001,
-- and the case filing form reverse-geocodes into it. Media never did. A field
-- recording stores `gps_latitude` and `gps_longitude` and nothing else, so
-- every screen that shows where a recording was made shows this:
--
--     GPS 6.524400, 3.379200 (±12m)
--
-- Which is precise, verifiable, and useless at a glance. An administrator
-- triaging a queue of field reports cannot tell Lagos from Kano without
-- copying two numbers into a map — and the reviewer screens are exactly where
-- someone needs to know where a thing happened without leaving the page.
--
-- WHY A STORED COLUMN RATHER THAN GEOCODING ON READ
--
-- Three reasons, in order of importance:
--
--   1. The address is evidence about the moment of capture. Geocoding on read
--      gives whatever the provider says today, which for a disputed boundary
--      or a renamed street is not what the recorder saw.
--   2. Nominatim is rate-limited and often unreachable from a handset in the
--      field. A queue of forty reports would make forty calls per page.
--   3. It must survive the provider. An address resolved once and written
--      down does not disappear when a free geocoder changes its terms.
--
-- The coordinates remain authoritative. The address is a convenience and is
-- explicitly nullable — a rural capture that will not geocode stores NULL, and
-- the clients fall back to the coordinates rather than inventing a place.
-- ============================================================================


-- ── SECTION 1 — the column ──────────────────────────────────────────────────

ALTER TABLE public.media_library
  ADD COLUMN IF NOT EXISTS gps_address TEXT;

ALTER TABLE public.media_reports
  ADD COLUMN IF NOT EXISTS gps_address TEXT;

COMMENT ON COLUMN public.media_library.gps_address IS
  'Reverse-geocoded at capture and stored, never re-derived on read. NULL when the fix would not geocode; clients then show the coordinates. The coordinates, not this, are authoritative.';

COMMENT ON COLUMN public.media_reports.gps_address IS
  'Carried over from the library item at submission. See media_library.gps_address.';


-- ── SECTION 2 — carry it through submission, AND UNBREAK IT ─────────────────
--
-- `submit_library_item_to_admin` has never worked. Its closing INSERT is:
--
--     INSERT INTO public.notifications (user_id, title, body, type, link)
--     SELECT p.user_id, 'Field report awaiting review', trim(p_title),
--            'media_report', '/app/admin/media-approvals'
--
-- and every one of the last three values is wrong:
--
--   * `body` is not a column. `notifications` has `message` (001), and 025
--     added only `pushed_at` and `push_attempts`. Postgres resolves this at
--     runtime and raises 42703.
--   * `'media_report'` violates the CHECK on `type`, which permits only
--     'info', 'warning', 'success' and 'error'.
--   * `/app/admin/media-approvals` is not a route. The approvals screen is
--     at `/app/admin/media`.
--
-- The INSERT is inside the function's transaction, so it does not merely fail
-- to notify — it aborts the whole call. A media agent submitting a field
-- report gets an error and no report is ever created. This is the last step
-- of the entire media-agent journey and it has been dead since 018.
--
-- Verified against production: `media_library` and the function both exist
-- (permission-denied rather than undefined), so 018 is applied as written.
--
-- The rest of the body is identical to 018. Repeated in full because
-- CREATE OR REPLACE takes the whole thing.
CREATE OR REPLACE FUNCTION public.submit_library_item_to_admin(
  p_item_id        UUID,
  p_institution_id UUID,
  p_title          TEXT,
  p_description    TEXT,
  p_tags           TEXT[] DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_item   public.media_library%ROWTYPE;
  v_report UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit a report';
  END IF;

  SELECT * INTO v_item
  FROM public.media_library
  WHERE id = p_item_id AND owner_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That item is not in your library';
  END IF;

  IF coalesce(trim(p_title), '') = '' THEN
    RAISE EXCEPTION 'Give the report a title';
  END IF;

  IF length(coalesce(trim(p_description), '')) < 20 THEN
    RAISE EXCEPTION 'Describe what the recording shows — at least 20 characters';
  END IF;

  INSERT INTO public.media_reports (
    institution_id, reporter_id, title, description, media_type,
    file_url, gps_latitude, gps_longitude, gps_address, tags, status
  )
  VALUES (
    p_institution_id, v_uid, trim(p_title), trim(p_description),
    CASE v_item.media_kind WHEN 'photo' THEN 'photo' ELSE v_item.media_kind END,
    v_item.file_path, v_item.gps_latitude, v_item.gps_longitude, v_item.gps_address,
    coalesce(p_tags, '{}'), 'pending_review'
  )
  RETURNING id INTO v_report;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT p.user_id,
         'Field report awaiting review',
         trim(p_title),
         'info',
         '/app/admin/media'
  FROM public.profiles p
  WHERE p.role = 'admin';

  RETURN v_report;
END;
$$;


-- ── SECTION 3 — verification ────────────────────────────────────────────────

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'media_library'
      AND column_name = 'gps_address'
  ) THEN
    RAISE EXCEPTION '033 failed: media_library.gps_address is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'media_reports'
      AND column_name = 'gps_address'
  ) THEN
    RAISE EXCEPTION '033 failed: media_reports.gps_address is missing';
  END IF;

  -- The submission fix is the load-bearing part of this migration. If the
  -- replacement did not take, field reports are still impossible to submit.
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'submit_library_item_to_admin'
      AND prosrc LIKE '%notifications (user_id, title, body,%'
  ) THEN
    RAISE EXCEPTION '033 failed: submit_library_item_to_admin still writes notifications.body';
  END IF;
END
$verify$;

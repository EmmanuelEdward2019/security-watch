-- ============================================================================
-- 018 — A personal media library for field capture                    (TSW-18)
-- ============================================================================
--
-- Reported: media personnel capture video, audio, photos and documents, but
-- everything captured had exactly one destination — a `media_reports` row
-- against a named institution — and nothing kept a record of the file itself.
-- There was no way to capture now and decide later, no way to reuse a clip on
-- a second case, and no way to attach something captured in the field to a
-- case rather than to an institution.
--
-- `media_reports` cannot serve as that library. `institution_id` is NOT NULL,
-- which is correct for a published allegation about a named institution and
-- exactly wrong for a file whose subject is not yet decided.
--
-- So: a library table that owns the file, plus two explicit exits from it —
-- attach to a case as evidence, or submit to an administrator as an
-- institution report. The library row survives both, so one capture can be
-- used twice without being uploaded twice.
--
-- Also covers material captured on a wearable or another device and imported
-- through the file picker, which is why `source` exists and why documents are
-- a first-class kind rather than an afterthought.
--
-- SAFETY
--   * New table only. Nothing existing is altered or dropped.
--   * RLS on from the start: an item is visible to its owner and to admins,
--     and to nobody else. Field material frequently identifies people who have
--     not consented to being recorded.
--   * The two exits are SECURITY DEFINER RPCs, so the integrity rules (hash
--     present, case membership, institution required) are enforced server-side
--     rather than trusted from a client.
-- ============================================================================

-- ── SECTION 1 — the table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.media_library (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  -- Storage path inside the private `media-reports` bucket, never a URL.
  -- Signed on read. Storing a URL here is what made KYC documents unopenable.
  file_path    TEXT NOT NULL,
  file_name    TEXT NOT NULL,
  file_type    TEXT NOT NULL,
  file_size    BIGINT NOT NULL CHECK (file_size > 0),

  -- SHA-256, lower-case hex. Same rule as evidence (012): without it nothing
  -- downstream can prove the file has not been altered since capture.
  file_hash    TEXT NOT NULL CHECK (file_hash ~ '^[0-9a-f]{64}$'),

  media_kind   TEXT NOT NULL CHECK (media_kind IN ('video', 'audio', 'photo', 'document')),

  -- 'capture' — recorded in the app, so the timestamp and coordinates below
  --             were observed rather than asserted.
  -- 'import'  — picked from the device: a wearable, a body camera, a scan.
  --             The metadata is whatever the file carried, and must not be
  --             presented as though the app witnessed it.
  source       TEXT NOT NULL DEFAULT 'capture' CHECK (source IN ('capture', 'import')),

  captured_at  TIMESTAMPTZ,
  gps_latitude  NUMERIC CHECK (gps_latitude IS NULL OR gps_latitude BETWEEN -90 AND 90),
  gps_longitude NUMERIC CHECK (gps_longitude IS NULL OR gps_longitude BETWEEN -180 AND 180),

  note         TEXT,
  duration_seconds INT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One row per stored object. Re-uploading the same path would otherwise
  -- create a second library entry pointing at one file, and deleting either
  -- would break the other.
  UNIQUE (owner_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_media_library_owner
  ON public.media_library(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_library_kind
  ON public.media_library(owner_id, media_kind);

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.media_library IS
  'Field material owned by the person who captured or imported it. Attaching '
  'to a case or submitting to an administrator copies from here; the library '
  'row survives, so one capture can be used more than once.';

-- ── SECTION 2 — policies ────────────────────────────────────────────────────
--
-- Deliberately narrow. This is unreviewed material that often shows people who
-- did not agree to be recorded, so it is owner-only plus admins. Investigators
-- and lawyers see it once it has been attached to a case they are on, through
-- the evidence policies — not here.

DROP POLICY IF EXISTS "media_library_select" ON public.media_library;
CREATE POLICY "media_library_select" ON public.media_library
  FOR SELECT USING (owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "media_library_insert" ON public.media_library;
CREATE POLICY "media_library_insert" ON public.media_library
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "media_library_update" ON public.media_library;
CREATE POLICY "media_library_update" ON public.media_library
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "media_library_delete" ON public.media_library;
CREATE POLICY "media_library_delete" ON public.media_library
  FOR DELETE USING (owner_id = auth.uid() OR public.is_admin());

-- ── SECTION 3 — exit 1: attach to a case as evidence ────────────────────────

CREATE OR REPLACE FUNCTION public.attach_library_item_to_case(
  p_item_id UUID,
  p_case_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_item      public.media_library%ROWTYPE;
  v_evidence  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to attach evidence';
  END IF;

  SELECT * INTO v_item
  FROM public.media_library
  WHERE id = p_item_id AND owner_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That item is not in your library';
  END IF;

  -- Attaching evidence to a case you are not part of would let anyone inject
  -- material into any investigation. shares_context_with() is the same check
  -- the messaging and notification paths use.
  IF NOT public.shares_context_with(v_uid, p_case_id) THEN
    RAISE EXCEPTION 'You are not a participant on that case';
  END IF;

  INSERT INTO public.evidence (
    case_id, uploaded_by, file_url, file_name, file_type,
    file_size, file_hash, description, chain_of_custody
  )
  VALUES (
    p_case_id, v_uid, v_item.file_path, v_item.file_name, v_item.file_type,
    v_item.file_size, v_item.file_hash,
    coalesce(p_description, v_item.note),
    jsonb_build_array(jsonb_build_object(
      'action',      'attached_from_library',
      'actor',       v_uid,
      'at',          now(),
      'library_item', v_item.id,
      'source',      v_item.source,
      'captured_at', v_item.captured_at
    ))
  )
  RETURNING id INTO v_evidence;

  RETURN v_evidence;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_library_item_to_case(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_library_item_to_case(UUID, UUID, TEXT) TO authenticated;

-- ── SECTION 4 — exit 2: submit to an administrator ──────────────────────────

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

  -- Always enters review. Publication stays an administrator's decision: that
  -- is what keeps unverified allegations about named institutions off the
  -- public archive.
  INSERT INTO public.media_reports (
    institution_id, reporter_id, title, description, media_type,
    file_url, gps_latitude, gps_longitude, tags, status
  )
  VALUES (
    p_institution_id, v_uid, trim(p_title), trim(p_description),
    CASE v_item.media_kind WHEN 'photo' THEN 'photo' ELSE v_item.media_kind END,
    v_item.file_path, v_item.gps_latitude, v_item.gps_longitude,
    coalesce(p_tags, '{}'), 'pending_review'
  )
  RETURNING id INTO v_report;

  -- Tell the administrators. The old client-side insert notified nobody, so
  -- reports sat in a queue no one knew had anything in it.
  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT p.user_id,
         'Field report awaiting review',
         trim(p_title),
         'media_report',
         '/app/admin/media-approvals'
  FROM public.profiles p
  WHERE p.role = 'admin';

  RETURN v_report;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_library_item_to_admin(UUID, UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_library_item_to_admin(UUID, UUID, TEXT, TEXT, TEXT[]) TO authenticated;

-- ── SECTION 5 — verify ──────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'media_library'
  ) THEN
    RAISE EXCEPTION '018 failed: media_library was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'media_library' AND rowsecurity
  ) THEN
    RAISE EXCEPTION '018 failed: RLS is not enabled on media_library';
  END IF;

  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'media_library') < 4 THEN
    RAISE EXCEPTION '018 failed: media_library is missing policies';
  END IF;

  -- The escalation that matters here: an item must never be attachable to a
  -- case the caller has nothing to do with.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'attach_library_item_to_case'
      AND p.prosrc LIKE '%shares_context_with%'
  ) THEN
    RAISE EXCEPTION '018 failed: attach_library_item_to_case does not check case membership';
  END IF;

  RAISE NOTICE '018 verified';
END;
$$;

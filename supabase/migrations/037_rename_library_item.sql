-- ============================================================================
-- 037 — Renaming a library item, and pinning everything else about it
-- ============================================================================
--
-- Agents asked to be able to rename what they have recorded. A capture is
-- named `field-report-1790057909234.mp4` by the app, which is useless for
-- finding the one you want three weeks later.
--
-- ── WHY THIS IS NOT JUST AN UPDATE ──────────────────────────────────────────
--
-- `media_library_update` (018) is:
--
--   FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())
--
-- which is every column, not just the name. The owner can already rewrite
-- `file_hash`, repoint `file_path` at a different object, or move
-- `captured_at` and the GPS columns. Nothing has exploited that, but building
-- a rename feature on top of it would make it routine — and the entire
-- evidential claim of this table is that the digest describes the bytes in the
-- bucket, and that the capture metadata was observed rather than asserted.
-- `attach_library_item_to_case` copies exactly those columns onto `evidence`,
-- so a rewritten hash travels into a case file.
--
-- So: a trigger pins the provenance columns, and renaming goes through a
-- function that can only touch the name.
--
-- Only `file_name` and `note` remain writable from a client. Both are
-- descriptions the owner authored; neither is a claim about the recording.
-- ============================================================================


-- ── SECTION 1 — provenance is immutable ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_media_library()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Server-side paths (the rename function, and anything running as the
  -- service role for a migration or a sweep) elevate deliberately.
  IF public.tsw_is_elevated() THEN
    RETURN NEW;
  END IF;

  NEW.id            := OLD.id;
  NEW.owner_id      := OLD.owner_id;
  NEW.file_path     := OLD.file_path;
  NEW.file_type     := OLD.file_type;
  NEW.file_size     := OLD.file_size;
  NEW.file_hash     := OLD.file_hash;
  NEW.media_kind    := OLD.media_kind;
  NEW.source        := OLD.source;
  NEW.captured_at   := OLD.captured_at;
  NEW.gps_latitude  := OLD.gps_latitude;
  NEW.gps_longitude := OLD.gps_longitude;
  NEW.gps_address   := OLD.gps_address;
  NEW.duration_seconds := OLD.duration_seconds;
  NEW.created_at    := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_library_guard ON public.media_library;
CREATE TRIGGER media_library_guard
  BEFORE UPDATE ON public.media_library
  FOR EACH ROW EXECUTE FUNCTION public.guard_media_library();


-- ── SECTION 2 — renaming ────────────────────────────────────────────────────

-- Returns the stored name, which is not always the one that was asked for:
-- the extension is kept so a download still opens in something.
CREATE OR REPLACE FUNCTION public.rename_library_item(
  p_item_id UUID,
  p_name    TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_item  public.media_library%ROWTYPE;
  v_clean TEXT;
  v_ext   TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to rename a recording';
  END IF;

  SELECT * INTO v_item
  FROM public.media_library
  WHERE id = p_item_id AND owner_id = v_uid;

  IF NOT FOUND THEN
    -- Same message whether it does not exist or belongs to someone else: the
    -- difference is not this caller's to learn.
    RAISE EXCEPTION 'That recording is not in your library';
  END IF;

  -- Slashes and control characters out: this name is offered as a download
  -- filename, and a path separator in it is somebody else's bug waiting.
  v_clean := regexp_replace(coalesce(p_name, ''), '[[:cntrl:]/\\]', '', 'g');
  v_clean := btrim(regexp_replace(v_clean, '\s+', ' ', 'g'));

  IF v_clean = '' THEN
    RAISE EXCEPTION 'Give the recording a name';
  END IF;

  v_clean := left(v_clean, 120);

  -- Keep the original extension. Without it a renamed clip downloads as a
  -- file the operating system cannot open, which looks like data loss.
  v_ext := substring(v_item.file_name FROM '\.([A-Za-z0-9]{1,8})$');
  IF v_ext IS NOT NULL AND lower(v_clean) NOT LIKE '%.' || lower(v_ext) THEN
    v_clean := v_clean || '.' || v_ext;
  END IF;

  -- The guard above pins everything else; elevate so this write lands.
  PERFORM public.tsw_elevate();

  UPDATE public.media_library
  SET file_name = v_clean
  WHERE id = p_item_id;

  RETURN v_clean;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_library_item(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_library_item(UUID, TEXT) TO authenticated;


-- ── SECTION 3 — verification ────────────────────────────────────────────────

DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'media_library_guard') THEN
    RAISE EXCEPTION '037 failed: media_library provenance is not pinned';
  END IF;

  IF has_function_privilege('anon', 'public.rename_library_item(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '037 failed: rename_library_item is callable by anon';
  END IF;
END
$verify$;

COMMENT ON FUNCTION public.rename_library_item(UUID, TEXT) IS
  'Renames a library item the caller owns. The only supported way to change file_name; every other column is pinned by media_library_guard.';

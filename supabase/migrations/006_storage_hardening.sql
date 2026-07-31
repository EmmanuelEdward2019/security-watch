-- =============================================================================
-- 006 — STORAGE HARDENING
-- =============================================================================
-- 002 left three problems:
--
--   * `evidence` accepted an upload from any authenticated user at any path,
--     and the app uploads with upsert enabled — so evidence files could be
--     silently overwritten, defeating the chain of custody.        (TSW-07)
--
--   * `evidence` reads required the first path segment to equal auth.uid(),
--     but uploads are keyed by case_id, and there was no admin policy at all.
--     Nobody could read evidence. Same gap for kyc-documents.      (TSW-11)
--
--   * `chat-files` and `media-reports` were readable by every logged-in
--     account, with no participant or approval check.              (TSW-12)
--
-- Object layout this migration assumes (the client matches it):
--
--   evidence/{case_id}/{uuid}-{name}
--   kyc-documents/{user_id}/{uuid}-{name}
--   property-documents/{property_id}/{uuid}-{name}
--   property-images/{user_id}/{uuid}-{name}
--   chat-files/{conversation_id}/{uuid}-{name}
--   media-reports/{user_id}/{uuid}-{name}
--   legal-documents/{author_id}/{uuid}-{name}
--   avatars/{user_id}/{name}
-- =============================================================================

-- =============================================================================
-- SECTION 1 — Buckets
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880,
   ARRAY['image/jpeg','image/png','image/gif','image/webp']),
  ('evidence', 'evidence', false, 104857600, NULL),
  ('property-images', 'property-images', true, 10485760,
   ARRAY['image/jpeg','image/png','image/webp']),
  ('property-documents', 'property-documents', false, 20971520,
   ARRAY['application/pdf','image/jpeg','image/png','image/webp',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('media-reports', 'media-reports', false, 209715200, NULL),
  ('kyc-documents', 'kyc-documents', false, 10485760,
   ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('chat-files', 'chat-files', false, 10485760, NULL),
  ('legal-documents', 'legal-documents', false, 20971520,
   ARRAY['application/pdf','image/jpeg','image/png',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- SECTION 2 — Path helpers
-- =============================================================================
-- storage.foldername() returns text; a malformed prefix must not raise, so the
-- cast is guarded.

CREATE OR REPLACE FUNCTION public.storage_uuid_prefix(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_first TEXT;
BEGIN
  v_first := (storage.foldername(p_name))[1];
  IF v_first IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_first::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.owns_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = p_property_id AND owner_id = auth.uid()
  );
$$;

-- True when the object belongs to a media report the caller may see.
CREATE OR REPLACE FUNCTION public.can_read_media_object(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.storage_uuid_prefix(p_name) = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.media_reports mr
      WHERE mr.file_url = p_name AND mr.status = 'published'
    );
$$;

GRANT EXECUTE ON FUNCTION public.storage_uuid_prefix(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_property(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_media_object(TEXT) TO anon, authenticated;

-- =============================================================================
-- SECTION 3 — Drop the permissive 002 policies
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own evidence" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view property images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload property documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own property documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view chat files" ON storage.objects;

-- =============================================================================
-- SECTION 4 — avatars (public read, own-folder write)
-- =============================================================================

CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND public.storage_uuid_prefix(name) = auth.uid()
  );

CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND public.storage_uuid_prefix(name) = auth.uid()
  );

CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (public.storage_uuid_prefix(name) = auth.uid() OR public.is_admin())
  );

-- =============================================================================
-- SECTION 5 — evidence (case participants only, no overwrite, no delete)
-- =============================================================================
-- The path is keyed by case, so participation is the correct test — this is
-- what makes evidence readable by the investigator and admin who need it.

CREATE POLICY "evidence_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evidence'
    AND (
      public.is_case_participant(public.storage_uuid_prefix(name))
      OR public.is_admin()
    )
  );

CREATE POLICY "evidence_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
    AND (
      public.is_case_participant(public.storage_uuid_prefix(name))
      OR public.is_admin()
    )
  );

-- Deliberately no UPDATE policy: an existing evidence object can never be
-- replaced, which is what makes the recorded SHA-256 meaningful. The client
-- also uploads with upsert disabled, so a colliding path fails loudly.

-- Only an admin may remove evidence, and only via the service role in practice.
CREATE POLICY "evidence_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'evidence' AND public.is_admin());

-- =============================================================================
-- SECTION 6 — property-images (public read, own-folder write)
-- =============================================================================

CREATE POLICY "property_images_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'property-images');

CREATE POLICY "property_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-images'
    AND public.storage_uuid_prefix(name) = auth.uid()
  );

CREATE POLICY "property_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-images'
    AND public.storage_uuid_prefix(name) = auth.uid()
  );

CREATE POLICY "property_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-images'
    AND (public.storage_uuid_prefix(name) = auth.uid() OR public.is_admin())
  );

-- =============================================================================
-- SECTION 7 — property-documents (owner and admin only; title deeds)
-- =============================================================================

CREATE POLICY "property_documents_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'property-documents'
    AND (
      public.owns_property(public.storage_uuid_prefix(name))
      OR public.is_admin()
    )
  );

CREATE POLICY "property_documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-documents'
    AND (
      public.owns_property(public.storage_uuid_prefix(name))
      OR public.is_admin()
    )
  );

CREATE POLICY "property_documents_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-documents'
    AND (
      public.owns_property(public.storage_uuid_prefix(name))
      OR public.is_admin()
    )
  );

-- =============================================================================
-- SECTION 8 — media-reports (uploader, or anyone once published)
-- =============================================================================
-- Anonymous read is intentional and narrow: the transparency archive is public,
-- but only for objects attached to a report an admin has published.

CREATE POLICY "media_reports_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'media-reports'
    AND (public.can_read_media_object(name) OR public.is_admin())
  );

CREATE POLICY "media_reports_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'media-reports'
    AND public.storage_uuid_prefix(name) = auth.uid()
  );

CREATE POLICY "media_reports_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'media-reports'
    AND (public.storage_uuid_prefix(name) = auth.uid() OR public.is_admin())
  );

-- =============================================================================
-- SECTION 9 — kyc-documents (owner and admin; admin read was missing)
-- =============================================================================

CREATE POLICY "kyc_documents_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents'
    AND (public.storage_uuid_prefix(name) = auth.uid() OR public.is_admin())
  );

CREATE POLICY "kyc_documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'kyc-documents'
    AND public.storage_uuid_prefix(name) = auth.uid()
  );

CREATE POLICY "kyc_documents_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'kyc-documents'
    AND (public.storage_uuid_prefix(name) = auth.uid() OR public.is_admin())
  );

-- =============================================================================
-- SECTION 10 — chat-files (conversation participants only)
-- =============================================================================

CREATE POLICY "chat_files_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-files'
    AND (
      public.is_conversation_participant(public.storage_uuid_prefix(name))
      OR public.is_admin()
    )
  );

CREATE POLICY "chat_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-files'
    AND public.is_conversation_participant(public.storage_uuid_prefix(name))
  );

CREATE POLICY "chat_files_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-files' AND public.is_admin());

-- =============================================================================
-- SECTION 11 — legal-documents (author, case participants, admin)
-- =============================================================================

CREATE POLICY "legal_documents_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'legal-documents'
    AND (
      public.storage_uuid_prefix(name) = auth.uid()
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.legal_documents ld
        WHERE ld.file_path = storage.objects.name
          AND ld.case_id IS NOT NULL
          AND public.is_case_participant(ld.case_id)
      )
    )
  );

CREATE POLICY "legal_documents_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'legal-documents'
    AND public.storage_uuid_prefix(name) = auth.uid()
    AND public.current_role_name() IN ('lawyer', 'admin')
  );

CREATE POLICY "legal_documents_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'legal-documents'
    AND (public.storage_uuid_prefix(name) = auth.uid() OR public.is_admin())
  );

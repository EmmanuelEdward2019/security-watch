-- =============================================================================
-- Storage Buckets
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp']),
  ('evidence', 'evidence', false, 52428800, NULL),
  ('property-images', 'property-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('property-documents', 'property-documents', false, 20971520, NULL),
  ('media-reports', 'media-reports', false, 104857600, NULL),
  ('kyc-documents', 'kyc-documents', false, 10485760, NULL),
  ('chat-files', 'chat-files', false, 10485760, NULL)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Storage Policies: Avatars (public read, authenticated upload)
-- =============================================================================

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- Storage Policies: Evidence (private, owner access)
-- =============================================================================

CREATE POLICY "Users can upload evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view own evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- Storage Policies: Property Images (public read, authenticated upload)
-- =============================================================================

CREATE POLICY "Anyone can view property images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

CREATE POLICY "Authenticated users can upload property images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own property images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own property images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- Storage Policies: Property Documents (private, owner access)
-- =============================================================================

CREATE POLICY "Users can upload property documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view own property documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- Storage Policies: Media Reports (private upload, public after approval)
-- =============================================================================

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media-reports' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media-reports' AND auth.role() = 'authenticated');

-- =============================================================================
-- Storage Policies: KYC Documents (private, owner + admin)
-- =============================================================================

CREATE POLICY "Users can upload KYC documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view own KYC documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================================================
-- Storage Policies: Chat Files (private, authenticated)
-- =============================================================================

CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view chat files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

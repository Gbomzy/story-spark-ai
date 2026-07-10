
CREATE POLICY "gm_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generated-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gm_write_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gm_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'generated-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gm_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'generated-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "gm_service_all" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'generated-media') WITH CHECK (bucket_id = 'generated-media');

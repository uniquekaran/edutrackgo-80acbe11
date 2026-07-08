
CREATE POLICY "syllabi bucket read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'syllabi');
CREATE POLICY "syllabi bucket write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'syllabi' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "syllabi bucket update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'syllabi' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')))
  WITH CHECK (bucket_id = 'syllabi' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "syllabi bucket delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'syllabi' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'teacher')));

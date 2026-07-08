
-- profiles: own + admin only
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Own profile or admin can read"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- student-avatars bucket: own folder or admin
DROP POLICY IF EXISTS "Avatars: authenticated read" ON storage.objects;
CREATE POLICY "Avatars: own folder read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- syllabi bucket: college folder check or teacher/admin
DROP POLICY IF EXISTS "syllabi bucket read" ON storage.objects;
CREATE POLICY "syllabi bucket read scoped"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'syllabi'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'teacher')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.college = (storage.foldername(name))[1]
      )
    )
  );

-- Lock down SECURITY DEFINER function EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
-- authenticated must retain EXECUTE on has_role because row-level policies invoke it.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

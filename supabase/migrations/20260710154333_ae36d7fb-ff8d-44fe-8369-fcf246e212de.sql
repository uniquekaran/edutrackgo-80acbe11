CREATE OR REPLACE FUNCTION public.is_vset_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'vset.official@gmail.com'
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = auth.uid()
        AND lower(u.email) = 'vset.official@gmail.com'
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_vset_admin() TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS "VSET admin can read all profiles" ON public.profiles;
CREATE POLICY "VSET admin can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_vset_admin());

DROP POLICY IF EXISTS "VSET admin can read all documents" ON public.documents;
CREATE POLICY "VSET admin can read all documents"
ON public.documents
FOR SELECT
TO authenticated
USING (public.is_vset_admin());

DROP POLICY IF EXISTS "VSET admin can read all roles" ON public.user_roles;
CREATE POLICY "VSET admin can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_vset_admin());

DROP POLICY IF EXISTS "VSET admin can manage roles" ON public.user_roles;
CREATE POLICY "VSET admin can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_vset_admin())
WITH CHECK (public.is_vset_admin());

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'vset.official@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
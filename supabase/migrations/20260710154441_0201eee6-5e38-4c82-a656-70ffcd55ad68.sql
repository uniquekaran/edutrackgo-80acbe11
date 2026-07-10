DROP POLICY IF EXISTS "VSET admin can read all profiles" ON public.profiles;
CREATE POLICY "VSET admin can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'vset.official@gmail.com');

DROP POLICY IF EXISTS "VSET admin can read all documents" ON public.documents;
CREATE POLICY "VSET admin can read all documents"
ON public.documents
FOR SELECT
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'vset.official@gmail.com');

DROP POLICY IF EXISTS "VSET admin can read all roles" ON public.user_roles;
CREATE POLICY "VSET admin can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'vset.official@gmail.com');

DROP POLICY IF EXISTS "VSET admin can manage roles" ON public.user_roles;
CREATE POLICY "VSET admin can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'vset.official@gmail.com')
WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'vset.official@gmail.com');

DROP FUNCTION IF EXISTS public.is_vset_admin();
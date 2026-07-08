
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS college text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS batch text,
  ADD COLUMN IF NOT EXISTS professional_tier text NOT NULL DEFAULT 'Member',
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_professional_tier_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_professional_tier_check
  CHECK (professional_tier IN ('Member','Silver','Gold','Platinum'));

-- 2. ppt_submissions
CREATE TABLE IF NOT EXISTS public.ppt_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot int NOT NULL CHECK (slot BETWEEN 1 AND 5),
  title text NOT NULL,
  file_path text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Revise')),
  reviewer_notes text,
  risk_recovery boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ppt_submissions TO authenticated;
GRANT ALL ON public.ppt_submissions TO service_role;
ALTER TABLE public.ppt_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ppt select" ON public.ppt_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own ppt insert" ON public.ppt_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ppt update" ON public.ppt_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own ppt delete" ON public.ppt_submissions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER ppt_submissions_touch BEFORE UPDATE ON public.ppt_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. broadcasts
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'core' CHECK (audience IN ('core','all')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcasts read" ON public.broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "broadcasts admin write" ON public.broadcasts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "broadcasts admin update" ON public.broadcasts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "broadcasts admin delete" ON public.broadcasts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;

-- 4. Elevate vset.official@gmail.com to admin (existing account, if present)
INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'vset.official@gmail.com'
  ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Auto-admin trigger update
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'vset.official@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

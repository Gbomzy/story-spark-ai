
-- 1. has_role: SECURITY DEFINER -> INVOKER. user_roles has self-read policy so callers can check their own roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. asset_versions: owner-scoped INSERT/UPDATE
CREATE POLICY "versions owner insert" ON public.asset_versions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "versions owner update" ON public.asset_versions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. project_assets: owner-scoped INSERT/UPDATE
CREATE POLICY "assets owner insert" ON public.project_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "assets owner update" ON public.project_assets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. generation_history: explicitly deny client writes (service_role only via admin client)
REVOKE INSERT, UPDATE ON public.generation_history FROM authenticated, anon;

-- 5. render_jobs / render_clip_jobs: explicitly deny client writes (service_role/trigger only)
REVOKE INSERT, UPDATE, DELETE ON public.render_jobs FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.render_clip_jobs FROM authenticated, anon;

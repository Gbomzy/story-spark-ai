
-- 1) SECURITY DEFINER functions: revoke EXECUTE from anon/public/authenticated.
--    Keep has_role executable by 'authenticated' because RLS policies reference it inline;
--    all others are only reachable via service_role (server functions / triggers).
REVOKE EXECUTE ON FUNCTION public.credit_grant(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_apply_credit_action(uuid, uuid, text, integer, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_commit(uuid, text, integer, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_reserve(uuid, text, integer, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_refund(uuid, text, integer, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.init_user_billing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- 2) audit_logs: users can no longer insert. Server code uses service_role.
DROP POLICY IF EXISTS "Users insert own audit logs" ON public.audit_logs;

-- 3) user_roles: explicit admin-only write policies (defense in depth).
DROP POLICY IF EXISTS "Admins manage user roles insert" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage user roles update" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage user roles delete" ON public.user_roles;

CREATE POLICY "Admins manage user roles insert"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage user roles update"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage user roles delete"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) generation_history / asset_versions / project_assets:
--    keep owner SELECT + DELETE; move INSERT/UPDATE to trusted server code (service_role bypasses RLS).
DROP POLICY IF EXISTS "history owner all"  ON public.generation_history;
DROP POLICY IF EXISTS "versions owner all" ON public.asset_versions;
DROP POLICY IF EXISTS "assets owner all"   ON public.project_assets;

CREATE POLICY "history owner select"
  ON public.generation_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "history owner delete"
  ON public.generation_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "versions owner select"
  ON public.asset_versions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "versions owner delete"
  ON public.asset_versions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "assets owner select"
  ON public.project_assets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "assets owner delete"
  ON public.project_assets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


REVOKE ALL ON FUNCTION public.credit_reserve(uuid, text, integer, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_commit(uuid, text, integer, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_refund(uuid, text, integer, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_grant(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.init_user_billing() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_reserve(uuid, text, integer, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_commit(uuid, text, integer, uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_refund(uuid, text, integer, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_grant(uuid, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

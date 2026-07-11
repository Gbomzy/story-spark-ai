
REVOKE EXECUTE ON FUNCTION public.admin_apply_credit_action(uuid,uuid,text,integer,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_credit_action(uuid,uuid,text,integer,text,text,jsonb) TO service_role;

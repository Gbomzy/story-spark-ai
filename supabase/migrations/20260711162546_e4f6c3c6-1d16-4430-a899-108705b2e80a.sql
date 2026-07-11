
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'credit_reserve(uuid, text, integer, uuid, text)',
    'credit_commit(uuid, text, integer, uuid, text, text, text)',
    'credit_refund(uuid, text, integer, uuid, text, text)',
    'credit_grant(uuid, integer, text, text, text)',
    'init_user_billing()',
    'set_referral_code()',
    'set_updated_at()',
    'handle_new_user()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;

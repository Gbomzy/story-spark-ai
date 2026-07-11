
ALTER TABLE public.credit_wallet
  ADD COLUMN IF NOT EXISTS unlimited_credits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lifetime_refunded integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.admin_credit_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  balance_before integer,
  balance_after integer,
  reason text NOT NULL,
  scope text NOT NULL DEFAULT 'single',
  affected_count integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_credit_actions TO authenticated;
GRANT ALL ON public.admin_credit_actions TO service_role;
ALTER TABLE public.admin_credit_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aca admin read" ON public.admin_credit_actions;
CREATE POLICY "aca admin read" ON public.admin_credit_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_aca_user_created ON public.admin_credit_actions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aca_admin_created ON public.admin_credit_actions(admin_id, created_at DESC);

-- Atomic admin wallet action: add | deduct | set | reset | unlimited_on | unlimited_off | beta_bonus
CREATE OR REPLACE FUNCTION public.admin_apply_credit_action(
  _admin uuid,
  _user uuid,
  _action text,
  _amount integer,
  _reason text,
  _scope text DEFAULT 'single',
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _bal integer; _new integer; _delta integer; _unl boolean;
BEGIN
  IF NOT public.has_role(_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'reason required';
  END IF;

  INSERT INTO public.credit_wallet(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  SELECT balance, unlimited_credits INTO _bal, _unl FROM public.credit_wallet WHERE user_id = _user FOR UPDATE;

  IF _action IN ('add','beta_bonus') THEN
    IF _amount <= 0 THEN RAISE EXCEPTION 'positive amount required'; END IF;
    _delta := _amount;
    _new := _bal + _amount;
    UPDATE public.credit_wallet SET
      balance = _new,
      bonus_credits = bonus_credits + _amount,
      lifetime_purchased = lifetime_purchased + _amount,
      updated_at = now()
    WHERE user_id = _user;
  ELSIF _action = 'deduct' THEN
    IF _amount <= 0 THEN RAISE EXCEPTION 'positive amount required'; END IF;
    _delta := -LEAST(_amount, _bal);
    _new := _bal + _delta;
    UPDATE public.credit_wallet SET balance = _new, lifetime_used = lifetime_used + (-_delta), updated_at = now() WHERE user_id = _user;
  ELSIF _action = 'set' THEN
    IF _amount < 0 THEN RAISE EXCEPTION 'non-negative amount required'; END IF;
    _new := _amount;
    _delta := _new - _bal;
    UPDATE public.credit_wallet SET balance = _new, updated_at = now() WHERE user_id = _user;
  ELSIF _action = 'reset' THEN
    _new := 0;
    _delta := -_bal;
    UPDATE public.credit_wallet SET balance = 0, updated_at = now() WHERE user_id = _user;
  ELSIF _action = 'unlimited_on' THEN
    _delta := 0; _new := _bal;
    UPDATE public.credit_wallet SET unlimited_credits = true, updated_at = now() WHERE user_id = _user;
  ELSIF _action = 'unlimited_off' THEN
    _delta := 0; _new := _bal;
    UPDATE public.credit_wallet SET unlimited_credits = false, updated_at = now() WHERE user_id = _user;
  ELSE
    RAISE EXCEPTION 'unknown action: %', _action;
  END IF;

  INSERT INTO public.credit_transactions(user_id, operation, credits, balance_before, balance_after, status, reason, ref_id)
  VALUES (_user, 'admin_' || _action, _delta, _bal, _new, 'completed', _reason, _admin::text);

  INSERT INTO public.admin_credit_actions(admin_id, user_id, action, amount, balance_before, balance_after, reason, scope, metadata)
  VALUES (_admin, _user, _action, _amount, _bal, _new, _reason, COALESCE(_scope,'single'), COALESCE(_metadata,'{}'::jsonb));

  RETURN jsonb_build_object('ok', true, 'balance', _new, 'delta', _delta);
END $$;

REVOKE ALL ON FUNCTION public.admin_apply_credit_action(uuid,uuid,text,integer,text,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_apply_credit_action(uuid,uuid,text,integer,text,text,jsonb) TO service_role;

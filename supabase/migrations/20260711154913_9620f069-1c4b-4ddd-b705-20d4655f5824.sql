
-- =========================================================
-- USER ROLES
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- =========================================================
-- SUBSCRIPTION PLANS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_credits integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  concurrent_jobs integer NOT NULL DEFAULT 1,
  storage_limit_mb integer NOT NULL DEFAULT 500,
  movie_length_seconds integer NOT NULL DEFAULT 60,
  publish_limit integer NOT NULL DEFAULT 5,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  stripe_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans public read" ON public.subscription_plans;
CREATE POLICY "plans public read" ON public.subscription_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "plans admin write" ON public.subscription_plans;
CREATE POLICY "plans admin write" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- CREDIT COST CATALOG
-- =========================================================
CREATE TABLE IF NOT EXISTS public.credit_costs (
  operation text PRIMARY KEY,
  label text NOT NULL,
  credits integer NOT NULL CHECK (credits >= 0),
  category text NOT NULL DEFAULT 'ai',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_costs TO authenticated;
GRANT ALL ON public.credit_costs TO service_role;
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "costs read" ON public.credit_costs;
CREATE POLICY "costs read" ON public.credit_costs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "costs admin write" ON public.credit_costs;
CREATE POLICY "costs admin write" ON public.credit_costs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- CREDIT WALLET
-- =========================================================
CREATE TABLE IF NOT EXISTS public.credit_wallet (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved integer NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_used integer NOT NULL DEFAULT 0,
  bonus_credits integer NOT NULL DEFAULT 0,
  subscription_credits integer NOT NULL DEFAULT 0,
  topup_credits integer NOT NULL DEFAULT 0,
  credits_expiring integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_wallet TO authenticated;
GRANT ALL ON public.credit_wallet TO service_role;
ALTER TABLE public.credit_wallet ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet self read" ON public.credit_wallet;
CREATE POLICY "wallet self read" ON public.credit_wallet FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "wallet admin read" ON public.credit_wallet;
CREATE POLICY "wallet admin read" ON public.credit_wallet FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- CREDIT TRANSACTIONS (immutable ledger)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid,
  operation text NOT NULL,
  provider text,
  model text,
  credits integer NOT NULL,
  balance_before integer NOT NULL,
  balance_after integer NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'completed',
  ref_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ref ON public.credit_transactions(ref_id);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tx self read" ON public.credit_transactions;
CREATE POLICY "tx self read" ON public.credit_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "tx admin read" ON public.credit_transactions;
CREATE POLICY "tx admin read" ON public.credit_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- USER SUBSCRIPTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'active',
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '1 month'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subs self read" ON public.user_subscriptions;
CREATE POLICY "subs self read" ON public.user_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "subs admin read" ON public.user_subscriptions;
CREATE POLICY "subs admin read" ON public.user_subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- CREDIT PURCHASES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  provider text NOT NULL,
  provider_session_id text,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON public.credit_purchases(user_id, created_at DESC);
GRANT SELECT ON public.credit_purchases TO authenticated;
GRANT ALL ON public.credit_purchases TO service_role;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "purch self read" ON public.credit_purchases;
CREATE POLICY "purch self read" ON public.credit_purchases FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "purch admin read" ON public.credit_purchases;
CREATE POLICY "purch admin read" ON public.credit_purchases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- ENGINE FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.credit_reserve(_user uuid, _operation text, _credits integer, _project uuid DEFAULT NULL, _ref text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal integer; _res integer;
BEGIN
  IF _credits <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  INSERT INTO public.credit_wallet(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  SELECT balance, reserved INTO _bal, _res FROM public.credit_wallet WHERE user_id = _user FOR UPDATE;
  IF _bal - _res < _credits THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_credits', 'balance', _bal - _res, 'required', _credits);
  END IF;
  UPDATE public.credit_wallet SET reserved = reserved + _credits, updated_at = now() WHERE user_id = _user;
  INSERT INTO public.credit_transactions(user_id, project_id, operation, credits, balance_before, balance_after, status, reason, ref_id)
  VALUES (_user, _project, _operation, -_credits, _bal, _bal, 'reserved', 'reserve', _ref);
  RETURN jsonb_build_object('ok', true, 'balance', _bal - _res - _credits, 'reserved', _res + _credits);
END $$;

CREATE OR REPLACE FUNCTION public.credit_commit(_user uuid, _operation text, _credits integer, _project uuid DEFAULT NULL, _provider text DEFAULT NULL, _model text DEFAULT NULL, _ref text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal integer; _res integer;
BEGIN
  SELECT balance, reserved INTO _bal, _res FROM public.credit_wallet WHERE user_id = _user FOR UPDATE;
  IF _res < _credits THEN RAISE EXCEPTION 'reserve mismatch'; END IF;
  UPDATE public.credit_wallet SET
    balance = balance - _credits,
    reserved = reserved - _credits,
    lifetime_used = lifetime_used + _credits,
    updated_at = now()
  WHERE user_id = _user;
  INSERT INTO public.credit_transactions(user_id, project_id, operation, provider, model, credits, balance_before, balance_after, status, reason, ref_id)
  VALUES (_user, _project, _operation, _provider, _model, -_credits, _bal, _bal - _credits, 'completed', 'commit', _ref);
  RETURN jsonb_build_object('ok', true, 'balance', _bal - _credits);
END $$;

CREATE OR REPLACE FUNCTION public.credit_refund(_user uuid, _operation text, _credits integer, _project uuid DEFAULT NULL, _ref text DEFAULT NULL, _reason text DEFAULT 'refund')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal integer; _res integer;
BEGIN
  SELECT balance, reserved INTO _bal, _res FROM public.credit_wallet WHERE user_id = _user FOR UPDATE;
  UPDATE public.credit_wallet SET reserved = GREATEST(0, reserved - _credits), updated_at = now() WHERE user_id = _user;
  INSERT INTO public.credit_transactions(user_id, project_id, operation, credits, balance_before, balance_after, status, reason, ref_id)
  VALUES (_user, _project, _operation, _credits, _bal, _bal, 'refunded', _reason, _ref);
  RETURN jsonb_build_object('ok', true, 'balance', _bal);
END $$;

CREATE OR REPLACE FUNCTION public.credit_grant(_user uuid, _credits integer, _reason text, _kind text DEFAULT 'topup', _ref text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal integer;
BEGIN
  IF _credits <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  INSERT INTO public.credit_wallet(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  SELECT balance INTO _bal FROM public.credit_wallet WHERE user_id = _user FOR UPDATE;
  UPDATE public.credit_wallet SET
    balance = balance + _credits,
    lifetime_purchased = CASE WHEN _kind IN ('topup','subscription') THEN lifetime_purchased + _credits ELSE lifetime_purchased END,
    topup_credits = CASE WHEN _kind = 'topup' THEN topup_credits + _credits ELSE topup_credits END,
    subscription_credits = CASE WHEN _kind = 'subscription' THEN subscription_credits + _credits ELSE subscription_credits END,
    bonus_credits = CASE WHEN _kind = 'bonus' THEN bonus_credits + _credits ELSE bonus_credits END,
    updated_at = now()
  WHERE user_id = _user;
  INSERT INTO public.credit_transactions(user_id, operation, credits, balance_before, balance_after, status, reason, ref_id)
  VALUES (_user, _kind, _credits, _bal, _bal + _credits, 'completed', _reason, _ref);
  RETURN jsonb_build_object('ok', true, 'balance', _bal + _credits);
END $$;

-- =========================================================
-- Signup trigger: wallet + Free plan + Free credits
-- =========================================================
CREATE OR REPLACE FUNCTION public.init_user_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.credit_wallet(user_id, balance, subscription_credits)
  VALUES (NEW.id, 100, 100) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_subscriptions(user_id, plan_id) VALUES (NEW.id, 'free') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.credit_transactions(user_id, operation, credits, balance_before, balance_after, status, reason)
  VALUES (NEW.id, 'signup_bonus', 100, 0, 100, 'completed', 'Welcome bonus');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_billing ON auth.users;
CREATE TRIGGER on_auth_user_created_billing AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.init_user_billing();

-- =========================================================
-- SEED plans + cost catalog
-- =========================================================
INSERT INTO public.subscription_plans (id, name, monthly_credits, price_cents, features, concurrent_jobs, storage_limit_mb, movie_length_seconds, publish_limit, sort_order) VALUES
  ('free',       'Free',       100,     0, '["100 credits/mo","1 concurrent job","Watermarked exports"]'::jsonb, 1, 500, 60,   3, 0),
  ('starter',    'Starter',    1500,   900, '["1,500 credits/mo","2 concurrent jobs","1080p exports"]'::jsonb, 2, 2000, 180,  10, 1),
  ('pro',        'Pro',        5000,  2900, '["5,000 credits/mo","4 concurrent jobs","4K exports","Priority queue"]'::jsonb, 4, 10000, 600, 50, 2),
  ('business',   'Business',  15000,  7900, '["15,000 credits/mo","8 concurrent jobs","Team workspace","API access"]'::jsonb, 8, 50000, 1800, 200, 3),
  ('enterprise', 'Enterprise', 50000, 24900, '["50,000 credits/mo","Unlimited concurrency","Dedicated support","SSO"]'::jsonb, 32, 250000, 7200, 1000, 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.credit_costs (operation, label, credits, category) VALUES
  ('story', 'Story', 5, 'text'),
  ('characters', 'Characters', 5, 'text'),
  ('storyboard', 'Storyboard', 10, 'text'),
  ('image_prompt', 'Image Prompt', 2, 'text'),
  ('image_generation', 'Image Generation', 20, 'image'),
  ('voice_script', 'Voice Script', 5, 'text'),
  ('voice_generation', 'Voice Generation', 15, 'audio'),
  ('video_clip', 'Video Clip', 40, 'video'),
  ('ocr', 'OCR', 3, 'text'),
  ('translation', 'Translation', 3, 'text'),
  ('movie_composer', 'Movie Composer', 20, 'video'),
  ('publishing', 'Publishing', 2, 'meta')
ON CONFLICT (operation) DO NOTHING;


-- 0. credit_costs missing `unit`
ALTER TABLE public.credit_costs ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'per_call';

-- 1. subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS price_yearly_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_projects integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS paystack_plan_code_monthly text,
  ADD COLUMN IF NOT EXISTS paystack_plan_code_yearly text,
  ADD COLUMN IF NOT EXISTS flutterwave_plan_id_monthly text,
  ADD COLUMN IF NOT EXISTS flutterwave_plan_id_yearly text;

UPDATE public.subscription_plans SET currency = 'NGN' WHERE currency = 'USD' OR currency IS NULL;

INSERT INTO public.subscription_plans (id, name, price_cents, price_yearly_cents, currency, monthly_credits, max_projects, storage_limit_mb, publish_limit, movie_length_seconds, concurrent_jobs, features, is_active, sort_order)
VALUES
  ('free',       'Free',       0,        0,         'NGN', 100,   1,   200,   5,    30,  1, '["Watermarked exports"]'::jsonb, true, 0),
  ('starter',    'Starter',    500000,   4800000,   'NGN', 1500,  5,   2000,  30,   90,  2, '["HD exports","All generators","Priority queue"]'::jsonb, true, 1),
  ('creator',    'Creator',    1500000,  14400000,  'NGN', 5000,  20,  10000, 150,  180, 3, '["4K exports","All generators","Priority queue","Publishing suite"]'::jsonb, true, 2),
  ('pro',        'Pro',        3500000,  33600000,  'NGN', 15000, 100, 50000, 1000, 600, 5, '["4K exports","All generators","Priority queue","Publishing suite","API access","Team seats"]'::jsonb, true, 3),
  ('enterprise', 'Enterprise', 15000000, 144000000, 'NGN', 100000,10000,500000,10000,3600,20,'["Everything","SLA","SSO","Dedicated support","Custom models"]'::jsonb, true, 4)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, price_cents=EXCLUDED.price_cents, price_yearly_cents=EXCLUDED.price_yearly_cents,
  currency=EXCLUDED.currency, monthly_credits=EXCLUDED.monthly_credits, max_projects=EXCLUDED.max_projects,
  storage_limit_mb=EXCLUDED.storage_limit_mb, publish_limit=EXCLUDED.publish_limit,
  movie_length_seconds=EXCLUDED.movie_length_seconds, concurrent_jobs=EXCLUDED.concurrent_jobs,
  features=EXCLUDED.features, is_active=EXCLUDED.is_active, sort_order=EXCLUDED.sort_order,
  updated_at=now();

-- 2. user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly'));

-- 3. credit_purchases
ALTER TABLE public.credit_purchases
  ADD COLUMN IF NOT EXISTS pack_id uuid,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS credit_purchases_provider_ref_uidx
  ON public.credit_purchases(provider, provider_reference) WHERE provider_reference IS NOT NULL;

-- 4. credit_packs
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  bonus_label text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_packs TO anon, authenticated;
GRANT ALL ON public.credit_packs TO service_role;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_packs public read" ON public.credit_packs FOR SELECT USING (is_active = true);
CREATE POLICY "credit_packs admin manage" ON public.credit_packs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.credit_packs (name, credits, price_cents, currency, bonus_label, sort_order) VALUES
  ('500 Credits',    500,   200000,  'NGN', NULL,          1),
  ('1,000 Credits',  1000,  380000,  'NGN', '5% off',      2),
  ('2,500 Credits',  2500,  900000,  'NGN', 'Best value',  3),
  ('5,000 Credits',  5000,  1700000, 'NGN', '15% off',     4),
  ('10,000 Credits', 10000, 3200000, 'NGN', '20% off',     5)
ON CONFLICT DO NOTHING;

-- 5. invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES public.credit_purchases(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_invoice_id text,
  provider_reference text,
  kind text NOT NULL CHECK (kind IN ('subscription','credit_pack','topup','refund')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending','void','refunded','failed')),
  description text,
  pdf_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices own read" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "invoices admin manage" ON public.invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS invoices_user_idx ON public.invoices(user_id, created_at DESC);

-- 6. coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  percent_off numeric(5,2) CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  amount_off_cents integer CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  bonus_credits integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  max_redemptions integer,
  redemptions integer NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('subscription','credit_pack','both')),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons read" ON public.coupons FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "coupons admin manage" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 7. refunds
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES public.credit_purchases(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_refund_id text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  credits_reversed integer NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','pending','failed')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds own read" ON public.refunds FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "refunds admin manage" ON public.refunds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 8. seed generator costs
INSERT INTO public.credit_costs (operation, label, category, credits, unit, is_active) VALUES
  ('story',       'Story generation',      'text',  10, 'per_call',   true),
  ('character',   'Character generation',  'text',   8, 'per_call',   true),
  ('storyboard',  'Storyboard generation', 'text',  15, 'per_call',   true),
  ('image',       'Image generation',      'image',  5, 'per_image',  true),
  ('voice',       'Voice generation',      'audio',  4, 'per_minute', true),
  ('video',       'Video generation',      'video',  2, 'per_second', true),
  ('ocr',         'OCR extraction',        'text',   3, 'per_call',   true),
  ('translation', 'Translation',           'text',   2, 'per_call',   true)
ON CONFLICT (operation) DO UPDATE SET label=EXCLUDED.label, category=EXCLUDED.category, unit=EXCLUDED.unit, updated_at=now();

-- 9. realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_wallet;

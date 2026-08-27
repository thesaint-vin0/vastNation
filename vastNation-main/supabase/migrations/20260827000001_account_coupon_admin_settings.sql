/*
  Vast Nation account settings, coupon limits and admin/store settings.
*/

-- ============================================================
-- USER SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_updates boolean NOT NULL DEFAULT true,
  payment_updates boolean NOT NULL DEFAULT true,
  shipping_updates boolean NOT NULL DEFAULT true,
  product_alerts boolean NOT NULL DEFAULT false,
  newsletter boolean NOT NULL DEFAULT true,
  promotional_offers boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'dark'
    CHECK (theme IN ('system', 'light', 'dark')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_settings" ON public.user_settings;
CREATE POLICY "select_own_user_settings"
ON public.user_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_user_settings" ON public.user_settings;
CREATE POLICY "insert_own_user_settings"
ON public.user_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_user_settings" ON public.user_settings;
CREATE POLICY "update_own_user_settings"
ON public.user_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_user_settings ON public.profiles;
CREATE TRIGGER on_profile_created_user_settings
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_settings();

-- Backfill existing users.
INSERT INTO public.user_settings (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================
-- COUPON LIMITS
-- ============================================================

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS usage_limit integer,
  ADD COLUMN IF NOT EXISTS per_user_limit integer,
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_usage_limit_check;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_usage_limit_check
  CHECK (usage_limit IS NULL OR usage_limit > 0);

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_per_user_limit_check;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_per_user_limit_check
  CHECK (per_user_limit IS NULL OR per_user_limit > 0);

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_value_check;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_value_check
  CHECK (value > 0);

-- ============================================================
-- COUPON USAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id, order_id)
);

ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_coupon_usage" ON public.coupon_usage;
CREATE POLICY "select_own_coupon_usage"
ON public.coupon_usage FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon
ON public.coupon_usage(coupon_id);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_user
ON public.coupon_usage(user_id);

-- Backfill coupon usage from already-paid orders so limits start from
-- the real historical count.
INSERT INTO public.coupon_usage (coupon_id, order_id, user_id)
SELECT c.id, o.id, o.user_id
FROM public.orders o
JOIN public.coupons c
  ON c.code = upper(trim(o.coupon_code))
WHERE o.payment_status = 'paid'
  AND o.coupon_code IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;

UPDATE public.coupons c
SET usage_count = (
  SELECT count(*)::integer
  FROM public.coupon_usage u
  WHERE u.coupon_id = c.id
);

CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_coupon_code text,
  p_user_id uuid,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  current_user_usage integer;
BEGIN
  SELECT *
  INTO c
  FROM public.coupons
  WHERE code = upper(trim(p_coupon_code))
  FOR UPDATE;

  IF NOT FOUND OR NOT c.active THEN
    RETURN false;
  END IF;

  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN
    RETURN false;
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN false;
  END IF;

  IF c.usage_limit IS NOT NULL
     AND c.usage_count >= c.usage_limit THEN
    RETURN false;
  END IF;

  SELECT count(*)::integer
  INTO current_user_usage
  FROM public.coupon_usage
  WHERE coupon_id = c.id
    AND user_id = p_user_id;

  IF c.per_user_limit IS NOT NULL
     AND current_user_usage >= c.per_user_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.coupon_usage (coupon_id, order_id, user_id)
  VALUES (c.id, p_order_id, p_user_id)
  ON CONFLICT (order_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.coupons
    SET usage_count = usage_count + 1
    WHERE id = c.id;
    RETURN true;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text, uuid, uuid) TO service_role;


-- ============================================================
-- ADMIN / STORE SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_settings (
  id uuid PRIMARY KEY,
  store_name text NOT NULL DEFAULT 'Vast Nation',
  store_email text NOT NULL DEFAULT '',
  store_phone text NOT NULL DEFAULT '',
  store_address text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'NGN',
  shipping_threshold numeric(12,2) NOT NULL DEFAULT 100000,
  default_shipping_fee numeric(12,2) NOT NULL DEFAULT 2500,
  express_shipping_fee numeric(12,2) NOT NULL DEFAULT 5000,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  maintenance_mode boolean NOT NULL DEFAULT false,
  notify_new_order boolean NOT NULL DEFAULT true,
  notify_payment boolean NOT NULL DEFAULT true,
  notify_low_stock boolean NOT NULL DEFAULT true,
  notify_new_review boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_store_settings" ON public.store_settings;
CREATE POLICY "admin_read_store_settings"
ON public.store_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "admin_insert_store_settings" ON public.store_settings;
CREATE POLICY "admin_insert_store_settings"
ON public.store_settings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "admin_update_store_settings" ON public.store_settings;
CREATE POLICY "admin_update_store_settings"
ON public.store_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

INSERT INTO public.store_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- REALTIME
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;
END
$$;

ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
ALTER TABLE public.coupons REPLICA IDENTITY FULL;
ALTER TABLE public.store_settings REPLICA IDENTITY FULL;

-- Admins can receive coupon/store changes through realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'coupons'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'store_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;
  END IF;
END
$$;


-- Public checkout-only settings. This does not expose admin notification
-- preferences or administrator data.
CREATE OR REPLACE FUNCTION public.get_checkout_settings()
RETURNS TABLE (
  shipping_threshold numeric,
  default_shipping_fee numeric,
  express_shipping_fee numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.shipping_threshold,
    s.default_shipping_fee,
    s.express_shipping_fee
  FROM public.store_settings AS s
  WHERE s.id = '00000000-0000-0000-0000-000000000001';
$$;

REVOKE ALL ON FUNCTION public.get_checkout_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_settings() TO anon, authenticated;

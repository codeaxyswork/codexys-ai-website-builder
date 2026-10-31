-- =====================================================================
-- CODEAXYS MIGRATION: ADD-ON PRICING & ENTITLEMENT FOUNDATION
-- Migration File: supabase/migrations/20261015_addon_pricing_foundation.sql
-- Description: Pure-additive tables and policies for optional paid add-ons.
-- Safety Invariant: Prepared migration only. DO NOT execute against production.
--
-- ROLLBACK SPECIFICATION:
-- To cleanly roll back this migration without affecting any core platform tables,
-- existing customer subscriptions, or base plans, execute:
--   DROP TABLE IF EXISTS public.user_addons CASCADE;
--   DROP TABLE IF EXISTS public.addons CASCADE;
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ADDONS CATALOG TABLE
-- Defines available add-on modules, operational status, and unapproved pricing.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.addons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('seo', 'marketing', 'agency', 'capacity')),
  description TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  billing_model TEXT NOT NULL CHECK (billing_model IN ('recurring_monthly', 'recurring_annual', 'one_time_pack')),
  eligible_base_plans TEXT[] NOT NULL DEFAULT ARRAY['starter', 'pro', 'business', 'agency'],
  monthly_price_inr INTEGER,
  annual_price_inr INTEGER,
  one_time_price_inr INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  quota_credits INTEGER NOT NULL DEFAULT 0,
  quota_websites INTEGER NOT NULL DEFAULT 0,
  quota_storage_bytes BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'mock_only')),
  operational_status TEXT NOT NULL DEFAULT 'operational' CHECK (operational_status IN ('operational', 'partially_implemented', 'unavailable')),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for catalog queries by category and status
CREATE INDEX IF NOT EXISTS idx_addons_category_status ON public.addons (category, status);

-- Enable RLS for addons catalog
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

-- Catalog visibility: Anyone can read addons (needed for pricing page & dashboard catalog)
DROP POLICY IF EXISTS "Anyone can view addons" ON public.addons;
CREATE POLICY "Anyone can view addons" ON public.addons
  FOR SELECT
  USING (true);

-- Catalog management: Only administrators and service_role can create or update catalog entries
DROP POLICY IF EXISTS "Admins can manage addons" ON public.addons;
CREATE POLICY "Admins can manage addons" ON public.addons
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- ---------------------------------------------------------------------
-- 2. USER ADDONS TABLE
-- Records customer add-on purchases, subscriptions, status, and period dates.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addon_id TEXT NOT NULL REFERENCES public.addons(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'expired')),
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly', 'annual', 'one_time')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  price_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user ownership lookups and active entitlement queries
CREATE INDEX IF NOT EXISTS idx_user_addons_user_id ON public.user_addons (user_id);
CREATE INDEX IF NOT EXISTS idx_user_addons_status_end ON public.user_addons (user_id, status, current_period_end);

-- Duplicate prevention: Prevent duplicate active recurring subscriptions for the same user & add-on
-- One-time packs (such as credit top-ups) are excluded to allow multiple pack purchases
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_addons_unique_active_recurring
  ON public.user_addons (user_id, addon_id)
  WHERE status = 'active' AND billing_interval != 'one_time';

-- Enable RLS for user addons
ALTER TABLE public.user_addons ENABLE ROW LEVEL SECURITY;

-- Read policy: Customers can only view their own add-on records
DROP POLICY IF EXISTS "Users can view own addons" ON public.user_addons;
CREATE POLICY "Users can view own addons" ON public.user_addons
  FOR SELECT
  USING (auth.uid() = user_id);

-- Modification policy: Customers CANNOT directly insert or modify their own add-ons
-- (Prevents client-side price, quota, or status manipulation)
-- Inserts and updates must go through server-side checkout APIs with service_role or admin privileges
DROP POLICY IF EXISTS "Admins or service_role can manage user addons" ON public.user_addons;
CREATE POLICY "Admins or service_role can manage user addons" ON public.user_addons
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));


-- ---------------------------------------------------------------------
-- 3. INITIAL ADDON SEED DATA (INACTIVE BY DEFAULT)
-- Seeds the 7 initial add-on definitions with unapproved placeholder prices.
-- ---------------------------------------------------------------------
INSERT INTO public.addons (
  id, name, category, description, features, billing_model, eligible_base_plans,
  monthly_price_inr, annual_price_inr, one_time_price_inr, currency,
  quota_credits, quota_websites, quota_storage_bytes,
  status, operational_status, is_approved, metadata
)
VALUES
  (
    'ai_visibility_tracker',
    'AI Visibility & LLM Tracker',
    'seo',
    'Continuous tracking of brand citations, sentiment, and rankings across OpenAI, Perplexity, Claude, and Gemini with automated change alerts.',
    '["Multi-provider LLM rank & citation probing", "Coverage across OpenAI, Perplexity, Claude, and Gemini", "Daily sentiment and competitor share-of-voice tracking", "Automated probe monitoring via background cron"]'::jsonb,
    'recurring_monthly',
    ARRAY['starter', 'pro'],
    299, 2990, NULL, 'INR',
    0, 0, 0,
    'inactive', 'operational', false,
    '{"probesPerMonth": 60}'::jsonb
  ),
  (
    'seo_autopilot_fix_agent',
    'SEO Autopilot & Fix Agent',
    'seo',
    'Autonomous background scanner that discovers on-page and technical SEO opportunities, auto-stages fixes, and applies self-healing code updates with 1-click rollback.',
    '["Weekly autonomous website architecture scans", "Automated staging of non-destructive metadata fixes", "1-click rollback via snapshot change history", "Automated audit logs in seo_autopilot_activity"]'::jsonb,
    'recurring_monthly',
    ARRAY['pro'],
    399, 3990, NULL, 'INR',
    0, 0, 0,
    'inactive', 'operational', false,
    '{"fixesPerMonth": 20}'::jsonb
  ),
  (
    'white_label_agency_reports',
    'White-Label Agency Reports',
    'agency',
    'Generate custom-branded client SEO audit reports with your agency logo, primary brand colors, client name, and unbranded shareable links.',
    '["Custom agency branding, logo, and footer signature", "Unbranded client-facing shareable web report links", "Exportable white-label PDF executive summaries", "Zero Codeaxys platform attribution on client exports"]'::jsonb,
    'recurring_monthly',
    ARRAY['pro', 'business'],
    499, 4990, NULL, 'INR',
    0, 0, 0,
    'inactive', 'operational', false,
    '{}'::jsonb
  ),
  (
    'extra_website_slot',
    'Extra Website Slot (+1 Site)',
    'capacity',
    'Publish an additional live website with full hosting, custom domain connection, and automated SSL certificate without upgrading to the next base plan.',
    '["+1 active live website publishing allowance", "1 customer-owned custom domain connection included", "Independent analytics, blog engine, and media library", "Fast edge CDN hosting and automated SSL"]'::jsonb,
    'recurring_monthly',
    ARRAY['starter', 'pro', 'business', 'agency'],
    199, 1990, NULL, 'INR',
    0, 1, 0,
    'inactive', 'operational', false,
    '{"incrementWebsites": 1}'::jsonb
  ),
  (
    'ai_credit_top_up_pack',
    'AI Credit Top-Up Pack (+250 Credits)',
    'capacity',
    'One-time boost of 250 AI credits that never expire while your account remains active. Safely preserved across monthly subscription renewals.',
    '["250 non-expiring AI credits added to your balance", "Usable for website generation, AI editing, and blog creation", "Preserved across monthly subscription renewal cycles", "Instant activation upon payment confirmation"]'::jsonb,
    'one_time_pack',
    ARRAY['free', 'starter', 'pro', 'business', 'agency'],
    NULL, NULL, 199, 'INR',
    250, 0, 0,
    'inactive', 'operational', false,
    '{"accountingModel": "additive_non_expiring"}'::jsonb
  ),
  (
    'media_storage_expansion',
    'Media Storage Expansion (+10 GB)',
    'capacity',
    'Expand your media storage quota by 10 GB for images, assets, and website media uploads.',
    '["+10 GB cloud asset storage allowance", "High-speed global CDN delivery", "Full WebP image optimization pipeline", "Zero file count limits within storage quota"]'::jsonb,
    'recurring_monthly',
    ARRAY['starter', 'pro', 'business', 'agency'],
    149, 1490, NULL, 'INR',
    0, 0, 10737418240,
    'inactive', 'operational', false,
    '{"storageIncrementBytes": 10737418240}'::jsonb
  ),
  (
    'digital_marketing_meta_suite',
    'Digital Marketing Tools (Meta Ads Suite)',
    'marketing',
    'AI marketing campaign strategy generation, Meta Ad Account & Facebook Page discovery, and direct ad campaign publishing via Meta Graph API.',
    '["AI Meta Ads campaign strategy planner", "Automatic Meta Ad Account & Page discovery", "Direct campaign publishing with idempotency protection", "Conversion lead tracking & analytics synchronization"]'::jsonb,
    'recurring_monthly',
    ARRAY['starter'],
    349, 3490, NULL, 'INR',
    0, 0, 0,
    'inactive', 'operational', false,
    '{"note": "Google Ads campaign publishing is mock-only and unavailable"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  billing_model = EXCLUDED.billing_model,
  eligible_base_plans = EXCLUDED.eligible_base_plans,
  monthly_price_inr = EXCLUDED.monthly_price_inr,
  annual_price_inr = EXCLUDED.annual_price_inr,
  one_time_price_inr = EXCLUDED.one_time_price_inr,
  quota_credits = EXCLUDED.quota_credits,
  quota_websites = EXCLUDED.quota_websites,
  quota_storage_bytes = EXCLUDED.quota_storage_bytes,
  operational_status = EXCLUDED.operational_status,
  updated_at = NOW();

-- Document tables and columns
COMMENT ON TABLE public.addons IS 'Catalog of optional paid add-ons for Codeaxys AI Website Builder';
COMMENT ON TABLE public.user_addons IS 'Purchased customer add-on subscriptions and one-time packs';
COMMENT ON COLUMN public.addons.is_approved IS 'Indicates whether finance & engineering have approved this add-on for sale';
COMMENT ON COLUMN public.addons.status IS 'Catalog visibility status: inactive (default), active, or mock_only';
COMMENT ON COLUMN public.user_addons.status IS 'Customer add-on status: active, canceled, past_due, or expired';

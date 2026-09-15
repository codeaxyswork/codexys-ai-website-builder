-- =====================================================================
-- SEO PHASE 8 MIGRATION: LOCAL SEO ENGINE
-- Table: public.website_local_seo
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.website_local_seo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  business_name TEXT,
  business_type TEXT DEFAULT 'LocalBusiness',
  primary_category TEXT,
  additional_categories TEXT[] DEFAULT '{}'::text[],
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_region TEXT,
  postal_code TEXT,
  country TEXT,
  phone TEXT,
  website_url TEXT,
  business_description TEXT,
  service_area TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  opening_hours JSONB DEFAULT '[]'::jsonb,
  price_range TEXT,
  logo_url TEXT,
  image_url TEXT,
  social_profiles TEXT[] DEFAULT '{}'::text[],
  contact_url TEXT,
  appointment_url TEXT,
  gbp_profile_url TEXT,
  local_seo_score INTEGER DEFAULT 0,
  analysis_result JSONB DEFAULT '{}'::jsonb,
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT website_local_seo_website_uniq UNIQUE (website_id)
);

ALTER TABLE public.website_local_seo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can view own website_local_seo" ON public.website_local_seo FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can insert own website_local_seo" ON public.website_local_seo FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can update own website_local_seo" ON public.website_local_seo FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own website_local_seo" ON public.website_local_seo;
CREATE POLICY "Users can delete own website_local_seo" ON public.website_local_seo FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_local_seo.website_id
    AND public.websites.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_website_local_seo_website ON public.website_local_seo(website_id);

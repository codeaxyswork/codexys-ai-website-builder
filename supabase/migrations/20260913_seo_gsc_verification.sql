-- =====================================================================
-- CODEAXYS AI WEBSITE BUILDER — SEO GSC VERIFICATION MIGRATION
-- Migration: 20260913_seo_gsc_verification.sql
-- Description: Per-website Google Search Console HTML meta tag verification token.
-- =====================================================================

-- 1. Add google_site_verification_token column to website_seo
ALTER TABLE public.website_seo
  ADD COLUMN IF NOT EXISTS google_site_verification_token TEXT;

-- 2. Configure verification token for Velocity Motors test website
UPDATE public.website_seo
SET google_site_verification_token = 'ODXf_Oowi3i3g-gHB_PaUZ6IvHCXfUMRVCUC_G14qBk',
    updated_at = NOW()
FROM public.websites
WHERE public.website_seo.website_id = public.websites.id
  AND (
    public.websites.published_slug = 'velocity-motors-an-elite-cinematic-automotive-gallery'
    OR public.websites.slug = 'velocity-motors-an-elite-cinematic-automotive-gallery'
  );

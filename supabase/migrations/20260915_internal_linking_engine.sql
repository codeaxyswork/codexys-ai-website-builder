-- =====================================================================
-- SEO PHASE 7 MIGRATION: INTERNAL LINKING ENGINE
-- Table: public.website_internal_links
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.website_internal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  internal_link_score INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}'::jsonb,
  link_graph JSONB DEFAULT '{}'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT website_internal_links_website_uniq UNIQUE (website_id)
);

ALTER TABLE public.website_internal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can view own website_internal_links" ON public.website_internal_links FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can insert own website_internal_links" ON public.website_internal_links FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can update own website_internal_links" ON public.website_internal_links FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own website_internal_links" ON public.website_internal_links;
CREATE POLICY "Users can delete own website_internal_links" ON public.website_internal_links FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_internal_links.website_id
    AND public.websites.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_website_internal_links_website ON public.website_internal_links(website_id);

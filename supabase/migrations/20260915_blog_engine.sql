-- =====================================================================
-- SEO PHASE 6 MIGRATION: CONTENT / BLOG ENGINE
-- Table: public.blog_posts
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  featured_image TEXT,
  author TEXT DEFAULT 'Admin',
  category TEXT DEFAULT 'General',
  tags TEXT[] DEFAULT '{}'::text[],
  seo_title TEXT,
  meta_description TEXT,
  focus_keyword TEXT,
  canonical_url TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  robots_config TEXT DEFAULT 'index, follow',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT blog_posts_website_slug_uniq UNIQUE (website_id, slug)
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can view own blog_posts" ON public.blog_posts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view published blog_posts" ON public.blog_posts;
CREATE POLICY "Anyone can view published blog_posts" ON public.blog_posts FOR SELECT USING (
  status = 'published' AND EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.blog_posts.website_id
    AND public.websites.is_published = true
  )
);

DROP POLICY IF EXISTS "Users can insert own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can insert own blog_posts" ON public.blog_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can update own blog_posts" ON public.blog_posts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own blog_posts" ON public.blog_posts;
CREATE POLICY "Users can delete own blog_posts" ON public.blog_posts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_blog_posts_website_id ON public.blog_posts(website_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON public.blog_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);

-- =====================================================================
-- SEO PHASE 9 MIGRATION: MONITORING + SCHEDULED SEO JOBS
-- Tables: public.website_monitoring_schedules, public.seo_monitoring_events
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. WEBSITE MONITORING SCHEDULES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_monitoring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  preferred_hour INTEGER DEFAULT 3,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  last_successful_run_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_frequency CHECK (frequency IN ('manual', 'daily', 'weekly', 'monthly'))
);

ALTER TABLE public.website_monitoring_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can view own website_monitoring_schedules" ON public.website_monitoring_schedules FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can insert own website_monitoring_schedules" ON public.website_monitoring_schedules FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can update own website_monitoring_schedules" ON public.website_monitoring_schedules FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own website_monitoring_schedules" ON public.website_monitoring_schedules;
CREATE POLICY "Users can delete own website_monitoring_schedules" ON public.website_monitoring_schedules FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.websites
    WHERE public.websites.id = public.website_monitoring_schedules.website_id
    AND public.websites.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_monitoring_schedules_next_run ON public.website_monitoring_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_schedules_website ON public.website_monitoring_schedules(website_id);

-- ---------------------------------------------------------------------
-- 2. SEO MONITORING EVENTS / ALERTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seo_monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  previous_value TEXT,
  current_value TEXT,
  affected_page TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_severity CHECK (severity IN ('critical', 'warning', 'info'))
);

ALTER TABLE public.seo_monitoring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can view own seo_monitoring_events" ON public.seo_monitoring_events FOR SELECT USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can insert own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can insert own seo_monitoring_events" ON public.seo_monitoring_events FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can update own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can update own seo_monitoring_events" ON public.seo_monitoring_events FOR UPDATE USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Users can delete own seo_monitoring_events" ON public.seo_monitoring_events;
CREATE POLICY "Users can delete own seo_monitoring_events" ON public.seo_monitoring_events FOR DELETE USING (
  auth.uid() = user_id
);

CREATE INDEX IF NOT EXISTS idx_monitoring_events_website ON public.seo_monitoring_events(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_events_unread ON public.seo_monitoring_events(user_id, is_read);

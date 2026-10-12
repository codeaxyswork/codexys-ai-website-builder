-- ====================================================================
-- Phase 1 Security Remediation: Add is_mock column to AI Visibility Logs
-- Safe, additive-only migration proposal.
-- DO NOT APPLY REMOTELY WITHOUT SYSTEM APPROVAL.
-- ====================================================================

ALTER TABLE public.seo_ai_visibility_logs 
ADD COLUMN IF NOT EXISTS is_mock BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_logs_is_mock 
ON public.seo_ai_visibility_logs(is_mock);

-- Backfill legacy mock records based on model_name prefix
UPDATE public.seo_ai_visibility_logs
SET is_mock = TRUE
WHERE model_name LIKE 'mock-%';

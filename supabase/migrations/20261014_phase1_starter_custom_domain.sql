-- Phase 1: Update Starter Plan to include 1 Custom Domain
-- NOTE: Prepared for staging/production migration. Do not execute against production database directly.

UPDATE public.plans
SET allow_custom_domain = true,
    updated_at = NOW()
WHERE id = 'starter';

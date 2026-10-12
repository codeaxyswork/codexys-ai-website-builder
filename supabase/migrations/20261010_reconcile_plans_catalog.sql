-- ====================================================================
-- Phase 1 Security Remediation: Plan Catalog Reconciliation Proposal
-- Safe, additive-only migration to ensure public.plans includes all plans
-- defined in lib/constants.ts:
--   Starter:  100 credits
--   Pro:      200 credits
--   Business: 400 credits
--   Agency:   800 credits
--   Free:      50 credits
-- DO NOT APPLY REMOTELY WITHOUT EXECUTIVE/PRODUCT SIGN-OFF ON PRICING.
-- ====================================================================

INSERT INTO public.plans (id, name, monthly_ai_credits, max_websites, storage_limit_bytes, allow_custom_domain, allow_advanced_seo)
VALUES 
  ('free', 'Free', 50, 1, 104857600, false, false),
  ('starter', 'Starter', 100, 1, 2147483648, false, false),
  ('pro', 'Pro', 200, 3, 10737418240, true, true),
  ('business', 'Business', 400, 6, 32212254720, true, true),
  ('agency', 'Agency', 800, 15, 107374182400, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_ai_credits = EXCLUDED.monthly_ai_credits,
  max_websites = EXCLUDED.max_websites,
  storage_limit_bytes = EXCLUDED.storage_limit_bytes,
  allow_custom_domain = EXCLUDED.allow_custom_domain,
  allow_advanced_seo = EXCLUDED.allow_advanced_seo;


-- ============================================================================
-- Codeaxys Migration: Data API Permissions & Supabase October 30, 2026 Compliance
-- File: supabase/migrations/20261022_data_api_permissions_october30_compliance.sql
-- Target Database: Supabase Staging (aiagulxavohemtdeihcm) & Production
--
-- Objectives:
-- 1. Ensure full compliance with the Supabase October 30, 2026 breaking change
--    removing default Data API (PostgREST) grants on newly created objects in public schema.
-- 2. Explicitly grant least-privilege permissions to authenticated, anon, and service_role.
-- 3. Strictly isolate sensitive customer billing, subscription, invoices, and credentials.
-- 4. Never grant anon access to private customer or payment data.
-- 5. Restrict server-only tables and sequential invoice generation to service_role.
-- 6. Guarantee zero regression on existing RLS policies and application queries.
--
-- Safety Invariants:
-- - Defensive, idempotent relation discovery via to_regclass/to_regprocedure.
-- - Granular privilege assignment matching actual RLS policies and application mutations.
-- - Wrapped in an atomic transaction with post-migration security invariant assertions.
-- - Prepared migration: DO NOT execute against database without explicit authorization.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
BEGIN

  -- --------------------------------------------------------------------------
  -- 1. FUNCTIONS, SCHEMA & SEQUENCE LEAST-PRIVILEGE HARDENING
  -- --------------------------------------------------------------------------

  -- 1A. Schema-Level Privileges
  -- PostgREST requires USAGE on public schema to resolve objects.
  EXECUTE 'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role';
  -- Disallow arbitrary object creation in public schema by client roles or PUBLIC
  EXECUTE 'REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated';

  -- 1B. Sequence-Level Privileges
  -- Prevent anon from querying or altering sequences; permit authenticated & service_role
  EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon';
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role';

  -- 1C. Default Privileges Hardening
  -- Ensure future objects do not automatically inherit broad public privileges.
  -- Scoped to CURRENT_USER and relevant object-creating roles (e.g., postgres)
  -- with defensive exception handling to accommodate cloud and local execution contexts.
  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated, PUBLIC';
      EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 1D. Function Privileges & RPC Restrictions

  -- Admin check helper used in RLS policies across profiles, audit logs, addons, and user_addons
  IF to_regprocedure('public.is_admin(UUID)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role';
  END IF;

  -- Reaffirm strict service_role-only restriction for sequential invoice generation RPC
  IF to_regprocedure('public.get_next_invoice_number(TEXT)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_next_invoice_number(TEXT) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(TEXT) TO service_role';
  END IF;

  -- Atomic credit deduction RPC (used by authenticated clients and server workflows)
  IF to_regprocedure('public.deduct_user_credits(UUID, INT, TEXT, UUID)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.deduct_user_credits(UUID, INT, TEXT, UUID) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.deduct_user_credits(UUID, INT, TEXT, UUID) TO authenticated, service_role';
  END IF;

  -- Atomic credit refund RPC (restricted strictly to server service_role)
  IF to_regprocedure('public.refund_user_credits(UUID, INT, TEXT, UUID)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) TO service_role';
  END IF;

  -- Internal refund resolver helper (strictly database internal, zero RPC exposure)
  IF to_regprocedure('public._resolve_deduction_action_for_refund(UUID, TEXT)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role';
  END IF;

  -- Auth user creation trigger function (trigger execution only, zero Data API execution)
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role';
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. TIER 1: PUBLIC CATALOG & PLATFORM SETTINGS (READ-ONLY FOR CLIENTS)
  FOREACH t IN ARRAY ARRAY['plans', 'addons', 'platform_settings'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- 3. TIER 2: PUBLISHED WEBSITE CONTENT (ANON READ PUBLISHED, AUTHENTICATED CRUD)
  -- RLS policies enforce `is_published = true` for public visitors and `user_id = auth.uid()` for owners.
  FOREACH t IN ARRAY ARRAY['websites', 'website_pages', 'website_seo', 'website_page_seo', 'blog_posts'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 4. TIER 3: CUSTOMER PRIVATE WORKSPACE & SEO/MARKETING (LEAST PRIVILEGE)
  -- Strictly isolated to account owner via RLS (auth.uid() = user_id). ZERO anon access.
  -- --------------------------------------------------------------------------

  -- 4A. Full CRUD Tables (SELECT, INSERT, UPDATE, DELETE backed by RLS)
  FOREACH t IN ARRAY ARRAY[
    'media_assets', 'marketing_leads', 'seo_analysis_jobs', 'seo_integrations',
    'gsc_search_analytics', 'website_internal_links', 'website_local_seo',
    'website_monitoring_schedules', 'seo_monitoring_events', 'website_third_party_seo_integrations',
    'website_aeo_analysis', 'seo_competitors', 'competitor_analyses', 'content_briefs',
    'seo_opportunities', 'seo_autopilot_settings', 'seo_autopilot_activity', 'technical_crawl_issues',
    'google_ads_keyword_cache', 'marketing_connections', 'marketing_ad_accounts',
    'marketing_pages', 'marketing_instagram_accounts', 'website_ai_visibility_configs',
    'marketing_campaign_drafts', 'marketing_campaign_executions', 'marketing_insights',
    'marketing_optimization_recommendations', 'marketing_action_logs'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- 4B. Non-Updatable Audit / Run Logs (SELECT, INSERT, DELETE backed by RLS - No UPDATE)
  FOREACH t IN ARRAY ARRAY[
    'seo_analysis_history', 'seo_unified_scores', 'technical_crawl_runs'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT SELECT, INSERT, DELETE ON TABLE public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- 4C. Non-Deletable Operational Records (SELECT, INSERT, UPDATE backed by RLS - No DELETE)
  FOREACH t IN ARRAY ARRAY[
    'ai_visibility_alerts'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- 4D. Append-Only Event Logs & Snapshots (SELECT, INSERT backed by RLS - No UPDATE, No DELETE)
  FOREACH t IN ARRAY ARRAY[
    'seo_ai_visibility_logs', 'content_revisions', 'content_refresh_runs',
    'ai_visibility_monitoring_runs', 'seo_integration_requests'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- 4E. Profiles Security: Column-Level Grants to Strictly Prevent Self-Role Escalation
  -- Authenticated users can only read profiles (subject to RLS) and update/insert
  -- non-privileged columns (full_name, avatar_url, updated_at).
  -- Privileged columns ('role', 'status') CANNOT be inserted or updated by authenticated users.
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.profiles FROM anon, authenticated, PUBLIC';
    EXECUTE 'REVOKE ALL (role, status) ON TABLE public.profiles FROM anon, authenticated, PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE public.profiles TO authenticated';
    EXECUTE 'GRANT UPDATE (full_name, avatar_url, updated_at) ON TABLE public.profiles TO authenticated';
    EXECUTE 'GRANT INSERT (id, full_name, avatar_url, updated_at) ON TABLE public.profiles TO authenticated';
    EXECUTE 'GRANT ALL ON TABLE public.profiles TO service_role';
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. TIER 4: SENSITIVE BILLING, SUBSCRIPTIONS & ENTITLEMENTS
  -- Customers can only read their own records. Mutations are strictly service_role.
  -- --------------------------------------------------------------------------
  FOREACH t IN ARRAY ARRAY[
    'subscriptions', 'billing_transactions', 'user_credits', 'ai_credit_transactions',
    'user_addons', 'admin_audit_logs'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 6. TIER 5: STRICTLY SERVER-ONLY SECRETS & CREDENTIALS
  -- Zero client access. Absolutely no anon or authenticated grants.
  -- --------------------------------------------------------------------------
  FOREACH t IN ARRAY ARRAY[
    'invoice_sequences', 'google_ads_oauth_credentials', 'gsc_oauth_credentials',
    'marketing_webhook_events'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', t);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 7. SECURITY INVARIANT POST-MIGRATION ASSERTION CHECKS
  -- --------------------------------------------------------------------------

  -- 7A. Assert that anon or PUBLIC role has ZERO access to private, financial, or credential tables
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee IN ('anon', 'PUBLIC')
      AND table_schema = 'public'
      AND table_name NOT IN (
        'plans', 'addons', 'platform_settings',
        'websites', 'website_pages', 'website_seo', 'website_page_seo', 'blog_posts'
      )
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: anon or PUBLIC role was granted access to private, financial, or credential tables!';
  END IF;

  -- 7B. Assert that anon or PUBLIC has ZERO mutation privileges on ANY table in public schema
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee IN ('anon', 'PUBLIC')
      AND table_schema = 'public'
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: anon or PUBLIC role was granted mutation privileges on public schema!';
  END IF;

  -- 7C. Assert that authenticated role CANNOT mutate billing or server-only tables
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee IN ('authenticated', 'PUBLIC')
      AND table_schema = 'public'
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
      AND table_name IN (
        'subscriptions', 'billing_transactions', 'user_credits', 'ai_credit_transactions',
        'user_addons', 'invoice_sequences', 'google_ads_oauth_credentials',
        'gsc_oauth_credentials', 'marketing_webhook_events', 'admin_audit_logs', 'profiles'
      )
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: authenticated or PUBLIC role was granted table-level mutation privileges on sensitive billing, credential, or profile table!';
  END IF;

  -- 7D. Assert that authenticated role CANNOT mutate catalog & settings tables (plans, addons, platform_settings)
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee IN ('authenticated', 'PUBLIC')
      AND table_schema = 'public'
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
      AND table_name IN ('plans', 'addons', 'platform_settings')
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: authenticated or PUBLIC role was granted mutation privileges on catalog or platform settings!';
  END IF;

  -- 7E. Assert that run-log tables do NOT have UPDATE privilege for authenticated
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee IN ('authenticated', 'PUBLIC')
      AND table_schema = 'public'
      AND privilege_type IN ('UPDATE', 'TRUNCATE')
      AND table_name IN ('seo_analysis_history', 'seo_unified_scores', 'technical_crawl_runs')
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: authenticated or PUBLIC role retains UPDATE privileges on non-updatable run-log tables!';
  END IF;

  -- 7F. Assert that append-only tables do NOT have UPDATE or DELETE privileges for authenticated
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee IN ('authenticated', 'PUBLIC')
      AND table_schema = 'public'
      AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE')
      AND table_name IN (
        'seo_ai_visibility_logs', 'content_revisions', 'content_refresh_runs',
        'ai_visibility_monitoring_runs', 'seo_integration_requests'
      )
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: authenticated or PUBLIC role retains UPDATE or DELETE privileges on append-only event logs!';
  END IF;

  -- 7G. Assert that authenticated or PUBLIC role CANNOT insert or update privileged profile columns (role, status)
  IF EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE grantee IN ('authenticated', 'anon', 'PUBLIC')
      AND table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('role', 'status')
      AND privilege_type IN ('INSERT', 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: authenticated, anon, or PUBLIC role was granted INSERT or UPDATE privilege on privileged profile columns (role, status)!';
  END IF;

  -- 7H. Assert that restricted sensitive functions CANNOT be executed by client or PUBLIC roles
  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'get_next_invoice_number', 'refund_user_credits',
        '_resolve_deduction_action_for_refund', 'handle_new_user'
      )
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
      AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Sensitive server function has EXECUTE granted to client or PUBLIC roles!';
  END IF;

  -- 7I. Assert that anon or PUBLIC has NO privileges on sequences in public schema
  IF EXISTS (
    SELECT 1 FROM information_schema.usage_privileges
    WHERE object_schema = 'public'
      AND object_type = 'SEQUENCE'
      AND grantee IN ('anon', 'PUBLIC')
  ) THEN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: anon or PUBLIC role retains USAGE privilege on sequences in public schema!';
  END IF;

  -- 7J. Assert that essential required privileges are preserved for application functionality
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name = 'websites'
      AND privilege_type = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'anon'
      AND table_schema = 'public'
      AND table_name = 'websites'
      AND privilege_type = 'SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name = 'profiles'
      AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'CRITICAL INTEGRITY FAILURE: Required application grants for websites or profiles are missing!';
  END IF;

  RAISE NOTICE 'Supabase October 30 Data API permissions successfully granted and security invariants verified.';
END $$;

COMMIT;

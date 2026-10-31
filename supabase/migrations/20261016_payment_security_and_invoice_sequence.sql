-- ============================================================================
-- Codeaxys Payment Security Hardening, Multi-Period Columns & Sequential Invoicing
-- Migration: 20261016_payment_security_and_invoice_sequence.sql
-- Target Database: Supabase Staging (aiagulxavohemtdeihcm)
--
-- Objectives:
-- 1. Ensure prerequisite multi-period billing columns exist on subscriptions and
--    billing_transactions with backward-compatible defaults.
-- 2. Enforce database-level uniqueness on completed provider payments to prevent
--    race conditions between concurrent verification and webhook executions.
-- 3. Enforce database-level uniqueness on pending order creations.
-- 4. Create public.invoice_sequences table and security-hardened atomic RPC
--    public.get_next_invoice_number() conforming to Indian CGST Rule 46.
-- 5. Harden function execution context (SET search_path = public, pg_temp) and
--    strictly restrict EXECUTE to trusted service_role.
-- 6. Reconcile public.plans catalog so foreign keys never fail during checkout.
--
-- NOTE: Safe, idempotent, and non-destructive. Do not execute on production
-- without authorized maintenance window.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PREREQUISITE MULTI-PERIOD BILLING COLUMNS (SUBSCRIPTIONS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS duration_months INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS last_credit_refreshed_at TIMESTAMPTZ DEFAULT NOW();

-- Add check constraints to enforce valid intervals and durations safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_billing_interval_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_billing_interval_check
      CHECK (billing_interval IN ('monthly', 'yearly', 'annual', 'triennial', '36_months'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_duration_months_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_duration_months_check
      CHECK (duration_months IN (1, 12, 36));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. PREREQUISITE MULTI-PERIOD BILLING COLUMNS (BILLING TRANSACTIONS)
-- ----------------------------------------------------------------------------

ALTER TABLE public.billing_transactions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2);

-- ----------------------------------------------------------------------------
-- 3. UNIQUE INDEXES ON BILLING TRANSACTIONS (IDEMPOTENCY & CONCURRENCY)
-- ----------------------------------------------------------------------------

-- Enforce uniqueness for completed payments per provider to guarantee idempotency
CREATE UNIQUE INDEX IF NOT EXISTS billing_transactions_provider_payment_completed_uniq
ON public.billing_transactions (provider, provider_payment_id)
WHERE status = 'completed' AND provider_payment_id IS NOT NULL;

-- Enforce uniqueness for pending checkout orders per provider
CREATE UNIQUE INDEX IF NOT EXISTS billing_transactions_provider_order_pending_uniq
ON public.billing_transactions (provider, provider_payment_id)
WHERE transaction_type = 'checkout_order_created' AND provider_payment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. SEQUENTIAL INVOICE NUMBERING ARCHITECTURE (CGST RULE 46 COMPLIANT)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  financial_year TEXT PRIMARY KEY,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Restrict direct access; invoice sequences are only manipulated via server service_role
DROP POLICY IF EXISTS "Service role access for invoice sequences" ON public.invoice_sequences;
CREATE POLICY "Service role access for invoice sequences"
ON public.invoice_sequences
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Atomic PostgreSQL RPC for sequential invoice number generation
-- Security Hardened: Fixed search_path prevents search_path hijacking
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_financial_year TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fy TEXT;
  v_seq INTEGER;
  v_inv_no TEXT;
BEGIN
  -- Default to current Indian Financial Year (April 1 to March 31)
  -- e.g. In October 2026, the financial year is 2026-27
  IF p_financial_year IS NULL OR p_financial_year = '' THEN
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
      v_fy := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(((EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER % 100) + 1)::TEXT, 2, '0');
    ELSE
      v_fy := (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1)::TEXT || '-' || LPAD(((EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER % 100))::TEXT, 2, '0');
    END IF;
  ELSE
    v_fy := p_financial_year;
  END IF;

  -- Atomic UPSERT with row-level locking on schema-qualified public.invoice_sequences
  INSERT INTO public.invoice_sequences (financial_year, current_sequence, updated_at)
  VALUES (v_fy, 1, NOW())
  ON CONFLICT (financial_year)
  DO UPDATE SET
    current_sequence = public.invoice_sequences.current_sequence + 1,
    updated_at = NOW()
  RETURNING current_sequence INTO v_seq;

  -- Format conforming to 16-character GST e-invoice limit: CDX/YY-YY/00001
  v_inv_no := 'CDX/' || SUBSTRING(v_fy FROM 3 FOR 2) || '-' || SUBSTRING(v_fy FROM 6 FOR 2) || '/' || LPAD(v_seq::TEXT, 5, '0');

  RETURN v_inv_no;
END;
$$;

-- Strict Security Grants: Revoke from public/anon/authenticated; grant only to service_role
REVOKE ALL ON FUNCTION public.get_next_invoice_number(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_invoice_number(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_next_invoice_number(TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. PLAN CATALOG RECONCILIATION & FOREIGN KEY INTEGRITY
-- ----------------------------------------------------------------------------

INSERT INTO public.plans (id, name, monthly_ai_credits, max_websites, storage_limit_bytes, allow_custom_domain, allow_advanced_seo)
VALUES 
  ('free', 'Free', 50, 1, 104857600, false, false),
  ('starter', 'Starter', 100, 1, 2147483648, true, false),
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

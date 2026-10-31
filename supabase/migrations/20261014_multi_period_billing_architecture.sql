-- Multi-Period Billing Architecture Migration (Backward Compatible)
-- Adds columns to support Monthly, Annual (12 mo), and Triennial (36 mo) billing terms.

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

-- Add corresponding columns to billing_transactions for complete financial tracking
ALTER TABLE public.billing_transactions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS duration_months INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2);

-- Document columns
COMMENT ON COLUMN public.subscriptions.billing_interval IS 'Billing term: monthly (1 mo), yearly (12 mo), or triennial (36 mo)';
COMMENT ON COLUMN public.subscriptions.duration_months IS 'Number of prepaid subscription months: 1, 12, or 36';
COMMENT ON COLUMN public.subscriptions.discount_percent IS 'Applicable discount rate: 0.00 for monthly, 16.67 for annual, 35.00 for 36 months';
COMMENT ON COLUMN public.subscriptions.last_credit_refreshed_at IS 'Timestamp of the last 30-day monthly AI credit replenishment';

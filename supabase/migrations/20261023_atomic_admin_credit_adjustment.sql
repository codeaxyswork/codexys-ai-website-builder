-- ====================================================================
-- Migration: Atomic Admin Credit Adjustment with Idempotency Protection
-- Migration File: supabase/migrations/20261023_atomic_admin_credit_adjustment.sql
-- Description:
--   1. Creates public.admin_idempotency_records table with strict RLS and service_role grant.
--   2. Adds check_user_credits_balance_non_negative constraint to public.user_credits.
--   3. Implements public.admin_adjust_user_credits stored procedure:
--      - Two-tier transactional advisory locking (Idempotency Key lock -> User lock).
--      - Atomic balance, ledger, audit, and idempotency record mutation.
--      - SHA-256 request fingerprint validation rejecting conflicting key reuse.
--      - Zero-side-effect business validations (no rows created on rejection).
--      - PostgREST Data API exposure prevention: execution granted strictly to service_role.
-- ====================================================================

BEGIN;

-- 1. Ensure Cryptographic Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 2. Admin Idempotency Records Table
CREATE TABLE IF NOT EXISTS public.admin_idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  adjustment_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  request_hash TEXT NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_idempotency_created 
  ON public.admin_idempotency_records(created_at);

-- Enforce strict RLS: No direct access from client Data API roles
ALTER TABLE public.admin_idempotency_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_idempotency_records FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_idempotency_records FROM anon;
REVOKE ALL ON TABLE public.admin_idempotency_records FROM authenticated;
GRANT ALL ON TABLE public.admin_idempotency_records TO service_role;

-- 3. Non-Negative Balance Constraint on user_credits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_user_credits_balance_non_negative'
      AND conrelid = 'public.user_credits'::regclass
  ) THEN
    ALTER TABLE public.user_credits
      ADD CONSTRAINT check_user_credits_balance_non_negative CHECK (balance >= 0);
  END IF;
END $$;

-- 4. Atomic Admin Credit Adjustment Stored Procedure
CREATE OR REPLACE FUNCTION public.admin_adjust_user_credits(
  p_admin_id UUID,
  p_user_id UUID,
  p_amount INT,
  p_type TEXT,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_credit_delta INT;
  v_row_exists BOOLEAN := FALSE;
  v_norm_key TEXT;
  v_norm_type TEXT;
  v_norm_reason TEXT;
  v_request_hash TEXT;
  v_existing RECORD;
BEGIN
  -- 1. Security Check: Direct execution restricted strictly to service_role
  IF auth.role() = 'authenticated' OR auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: admin_adjust_user_credits can only be executed by service_role';
  END IF;

  -- 2. Validate p_admin_id administrator status
  IF p_admin_id IS NULL OR NOT public.is_admin(p_admin_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'error', 'Caller does not possess verified administrative privileges.'
    );
  END IF;

  -- 3. Input Validation
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TARGET', 'error', 'Target user_id is required.');
  END IF;

  IF p_amount IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_AMOUNT', 'error', 'Credit amount cannot be null.');
  END IF;

  v_norm_type := lower(trim(COALESCE(p_type, '')));
  IF v_norm_type NOT IN ('add', 'set') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TYPE', 'error', 'Adjustment type must be "add" or "set".');
  END IF;

  IF v_norm_type = 'add' AND p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'ZERO_AMOUNT', 'error', 'Adjustment amount cannot be zero for "add".');
  END IF;

  IF v_norm_type = 'set' AND p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'NEGATIVE_SET', 'error', 'Credit balance cannot be set to a negative number.');
  END IF;

  -- 4. Mandatory Idempotency Key Validation
  v_norm_key := trim(COALESCE(p_idempotency_key, ''));
  IF v_norm_key = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'IDEMPOTENCY_KEY_REQUIRED', 'error', 'Idempotency key is mandatory.');
  END IF;

  v_norm_reason := lower(trim(COALESCE(NULLIF(trim(p_reason), ''), 'admin_adjustment')));

  -- 5. Concurrency Serialization: Strict Two-Tier Advisory Lock Ordering
  -- Tier 1: Lock on Idempotency Key (Global across all operations)
  PERFORM pg_advisory_xact_lock(('x' || substr(md5('idempotency_key:' || v_norm_key), 1, 16))::bit(64)::bigint);

  -- Tier 2: Lock on Target User ID
  PERFORM pg_advisory_xact_lock(('x' || substr(md5('credit_target_user:' || p_user_id::text), 1, 16))::bit(64)::bigint);

  -- 6. Check for Existing Idempotency Record & Fingerprint Validation
  v_request_hash := encode(digest(
    lower(trim(p_admin_id::text)) || '|' ||
    lower(trim(p_user_id::text)) || '|' ||
    'adjust_credits|' ||
    v_norm_type || '|' ||
    p_amount::text || '|' ||
    v_norm_reason,
    'sha256'
  ), 'hex');

  SELECT * INTO v_existing
  FROM public.admin_idempotency_records
  WHERE idempotency_key = v_norm_key;

  IF FOUND THEN
    -- Validate request fingerprint against existing record
    IF v_existing.admin_id != p_admin_id OR
       v_existing.target_user_id != p_user_id OR
       v_existing.request_hash != v_request_hash THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_KEY_REUSE_CONFLICT',
        'error', 'Idempotency key collision: This key was previously used for a different operation or parameter set.'
      );
    END IF;

    -- Return cached response without mutating state
    RETURN jsonb_build_object(
      'success', true,
      'status', 'idempotent_replay',
      'idempotent', true,
      'oldBalance', (v_existing.response_payload->>'oldBalance')::INT,
      'newBalance', (v_existing.response_payload->>'newBalance')::INT,
      'message', 'Request previously processed. Returned cached result without duplicate modification.'
    );
  END IF;

  -- 7. Verify Target User Exists in profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'error', 'Target user profile not found.');
  END IF;

  -- 8. Read Current Credit Record (with FOR UPDATE row lock if row exists)
  SELECT balance INTO v_current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NOT NULL THEN
    v_row_exists := TRUE;
  ELSE
    v_row_exists := FALSE;
    v_current_balance := 50; -- Default initial balance
  END IF;

  -- 9. Calculate New Balance and Invariant Check
  IF v_norm_type = 'set' THEN
    v_new_balance := p_amount;
    v_credit_delta := v_new_balance - v_current_balance;
  ELSE
    v_new_balance := v_current_balance + p_amount;
    v_credit_delta := p_amount;
  END IF;

  IF v_new_balance < 0 THEN
    -- Return immediately with zero side effects: no row is created or modified
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INSUFFICIENT_CREDITS',
      'error', format('Adjustment would result in a negative credit balance (%s). Current balance is %s.', v_new_balance, v_current_balance),
      'currentBalance', v_current_balance
    );
  END IF;

  -- 10. Atomic Database Writes
  -- 10A. Balance Update or Insert
  IF v_row_exists THEN
    UPDATE public.user_credits
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.user_credits (
      user_id,
      balance,
      monthly_used,
      lifetime_used,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      v_new_balance,
      0,
      0,
      NOW(),
      NOW()
    );
  END IF;

  -- 10B. Credit Ledger Write (Negative sign for credits added/granted)
  INSERT INTO public.ai_credit_transactions (
    user_id,
    website_id,
    credits_used,
    action_type,
    created_at
  ) VALUES (
    p_user_id,
    NULL,
    -v_credit_delta,
    v_norm_reason,
    NOW()
  );

  -- 10C. Admin Audit Log Write
  INSERT INTO public.admin_audit_logs (
    admin_id,
    action_type,
    target_user_id,
    details,
    created_at
  ) VALUES (
    p_admin_id,
    'ADMIN_CREDITS_ADJUSTED',
    p_user_id,
    jsonb_build_object(
      'oldBalance', v_current_balance,
      'newBalance', v_new_balance,
      'adjustment', p_amount,
      'type', v_norm_type,
      'reason', v_norm_reason,
      'idempotencyKey', v_norm_key
    ),
    NOW()
  );

  -- 10D. Idempotency Record Write
  INSERT INTO public.admin_idempotency_records (
    idempotency_key,
    admin_id,
    target_user_id,
    action_type,
    adjustment_type,
    amount,
    request_hash,
    response_payload,
    created_at
  ) VALUES (
    v_norm_key,
    p_admin_id,
    p_user_id,
    'adjust_credits',
    v_norm_type,
    p_amount,
    v_request_hash,
    jsonb_build_object(
      'success', true,
      'oldBalance', v_current_balance,
      'newBalance', v_new_balance,
      'adjustment', p_amount,
      'type', v_norm_type
    ),
    NOW()
  );

  -- 11. Return Success Result
  RETURN jsonb_build_object(
    'success', true,
    'status', 'complete',
    'idempotent', false,
    'oldBalance', v_current_balance,
    'newBalance', v_new_balance,
    'adjustment', p_amount,
    'type', v_norm_type,
    'message', format('User credits updated to %s.', v_new_balance)
  );

  -- Any unhandled write exception will naturally abort the entire transaction.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 5. Revoke and Grant Function Privileges (October 30 Data API Compliance)
REVOKE EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, UUID, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, UUID, INT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, UUID, INT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_credits(UUID, UUID, INT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;

-- ====================================================================
-- Phase 1 Production Readiness: Atomic Credit Refund RPC
-- Safe, additive-only function for atomic credit refunds with
-- row-level locking (FOR UPDATE), transaction audit logging,
-- deduction-to-refund relationship verification, and idempotency
-- safeguards against double refunds.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.refund_user_credits(
  p_user_id UUID,
  p_credits INT,
  p_action_type TEXT,
  p_website_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_balance INT;
  v_monthly_used INT;
  v_lifetime_used INT;
  v_orig_action TEXT;
  v_orig_deducted INT;
BEGIN
  -- Security check: Ensure authenticated/anon clients cannot invoke this function directly
  IF auth.role() = 'authenticated' OR auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: refund_user_credits can only be executed by service_role';
  END IF;

  -- Validation: Non-positive or null credit amounts are rejected
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Action type must be specified for traceability and idempotency
  IF p_action_type IS NULL OR trim(p_action_type) = '' THEN
    RETURN FALSE;
  END IF;

  -- Deduction-to-refund relationship verification:
  -- When p_action_type follows the standard 'refund:<deduction_action>' pattern,
  -- verify that an authentic prior deduction exists and refund does not exceed it.
  IF p_action_type LIKE 'refund:%' THEN
    v_orig_action := substring(p_action_type from 8);

    SELECT credits_used INTO v_orig_deducted
    FROM public.ai_credit_transactions
    WHERE user_id = p_user_id
      AND action_type = v_orig_action
      AND credits_used > 0
    ORDER BY created_at DESC
    LIMIT 1;

    -- Reject if no matching prior deduction is found
    IF v_orig_deducted IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Reject if refund amount exceeds original deduction
    IF p_credits > v_orig_deducted THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Row-level locking to prevent race conditions during concurrent refunds
  SELECT balance, monthly_used, lifetime_used 
  INTO v_balance, v_monthly_used, v_lifetime_used 
  FROM public.user_credits 
  WHERE user_id = p_user_id 
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Idempotency check: Prevent double refunds for identical action type/key
  IF EXISTS (
    SELECT 1 FROM public.ai_credit_transactions
    WHERE user_id = p_user_id
      AND action_type = p_action_type
      AND credits_used < 0
  ) THEN
    -- Already refunded for this exact action/probe reference
    RETURN FALSE;
  END IF;

  -- Update credit balance and safely decrease monthly/lifetime usage
  UPDATE public.user_credits
  SET balance = balance + p_credits,
      monthly_used = GREATEST(0, COALESCE(monthly_used, 0) - p_credits),
      lifetime_used = GREATEST(0, COALESCE(lifetime_used, 0) - p_credits),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Insert negative credit transaction audit record
  INSERT INTO public.ai_credit_transactions (user_id, website_id, credits_used, action_type)
  VALUES (p_user_id, p_website_id, -p_credits, p_action_type);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restrict execution: Revoke all from client roles, grant strictly to service_role
REVOKE EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_user_credits(UUID, INT, TEXT, UUID) TO service_role;



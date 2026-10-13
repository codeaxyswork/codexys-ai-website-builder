-- ====================================================================
-- Phase 1 Production Readiness: Atomic Credit Refund RPC & Deduction Resolver
-- Safe, additive-only functions for atomic credit refunds with
-- transactional advisory locking, row-level locking (FOR UPDATE),
-- strict deduction-to-refund deterministic relationship verification,
-- cumulative refund limits, unambiguous action resolution, and idempotency safeguards.
-- ====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._resolve_deduction_action_for_refund(
  p_user_id UUID,
  p_refund_action TEXT
) RETURNS TEXT AS $$
DECLARE
  v_after_refund TEXT;
  v_deduction_count INT;
  v_matched_action TEXT;
  v_candidates TEXT[];
  v_cand TEXT;
  v_cand_sub TEXT;
  v_delim_pos INT;
  v_candidate TEXT;
  v_cand_count INT;
  v_cand_action TEXT;
BEGIN
  -- Security check: Ensure authenticated/anon clients cannot invoke this function directly
  IF auth.role() = 'authenticated' OR auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: _resolve_deduction_action_for_refund is an internal helper and cannot be invoked directly';
  END IF;

  IF p_user_id IS NULL OR p_refund_action IS NULL OR NOT starts_with(p_refund_action, 'refund:') THEN
    RETURN NULL;
  END IF;

  v_after_refund := trim(substring(p_refund_action from 8));
  IF v_after_refund IS NULL OR v_after_refund = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Unambiguous exact match: v_after_refund matches original deduction action_type exactly
  SELECT count(*), max(action_type)
  INTO v_deduction_count, v_matched_action
  FROM public.ai_credit_transactions
  WHERE user_id = p_user_id
    AND action_type = v_after_refund
    AND credits_used > 0;

  IF v_deduction_count = 1 THEN
    RETURN v_matched_action;
  ELSIF v_deduction_count > 1 THEN
    -- Multiple deduction records for the exact same action key: ambiguous target, fail closed.
    RETURN NULL;
  END IF;

  -- 2. Structured partial refund matching & candidate deduction resolution
  v_candidates := ARRAY[]::TEXT[];

  -- Candidate stripping ai_visibility_probe: prefix (for credit-guard callers)
  IF starts_with(v_after_refund, 'ai_visibility_probe:') THEN
    v_cand := substring(v_after_refund from 21);
    IF v_cand IS NOT NULL AND v_cand != '' THEN
      v_candidates := array_append(v_candidates, v_cand);
      IF position('#' in v_cand) > 0 THEN
        v_delim_pos := length(v_cand) - position('#' in reverse(v_cand));
        IF v_delim_pos > 0 THEN
          v_candidates := array_append(v_candidates, substring(v_cand from 1 for v_delim_pos));
        END IF;
      END IF;
      IF position(':' in v_cand) > 0 THEN
        v_delim_pos := length(v_cand) - position(':' in reverse(v_cand));
        IF v_delim_pos > 0 THEN
          v_cand_sub := substring(v_cand from 1 for v_delim_pos);
          v_candidates := array_append(v_candidates, v_cand_sub);
          IF position(':' in v_cand_sub) > 0 THEN
            v_delim_pos := length(v_cand_sub) - position(':' in reverse(v_cand_sub));
            IF v_delim_pos > 0 THEN
              v_candidates := array_append(v_candidates, substring(v_cand_sub from 1 for v_delim_pos));
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Candidate stripping after last '#'
  IF position('#' in v_after_refund) > 0 THEN
    v_delim_pos := length(v_after_refund) - position('#' in reverse(v_after_refund));
    IF v_delim_pos > 0 THEN
      v_cand := substring(v_after_refund from 1 for v_delim_pos);
      IF v_cand IS NOT NULL AND v_cand != '' THEN
        v_candidates := array_append(v_candidates, v_cand);
      END IF;
    END IF;
    -- Also first '#' if different
    v_cand := split_part(v_after_refund, '#', 1);
    IF v_cand IS NOT NULL AND v_cand != '' THEN
      v_candidates := array_append(v_candidates, v_cand);
    END IF;
  END IF;

  -- Candidate stripping after last ':'
  IF position(':' in v_after_refund) > 0 THEN
    v_delim_pos := length(v_after_refund) - position(':' in reverse(v_after_refund));
    IF v_delim_pos > 0 THEN
      v_cand := substring(v_after_refund from 1 for v_delim_pos);
      IF v_cand IS NOT NULL AND v_cand != '' THEN
        v_candidates := array_append(v_candidates, v_cand);
        -- Also second-to-last ':' (for two-segment suffixes like ':part:1')
        IF position(':' in v_cand) > 0 THEN
          v_delim_pos := length(v_cand) - position(':' in reverse(v_cand));
          IF v_delim_pos > 0 THEN
            v_candidates := array_append(v_candidates, substring(v_cand from 1 for v_delim_pos));
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Iterate through candidate action types ordered by length descending (longest prefix first)
  FOR v_candidate IN
    SELECT c
    FROM (
      SELECT DISTINCT c
      FROM unnest(v_candidates) AS c
      WHERE c IS NOT NULL AND c != '' AND c != v_after_refund
    ) sub
    ORDER BY length(sub.c) DESC
  LOOP
    SELECT count(*), max(action_type)
    INTO v_cand_count, v_cand_action
    FROM public.ai_credit_transactions
    WHERE user_id = p_user_id
      AND action_type = v_candidate
      AND credits_used > 0;

    IF v_cand_count = 1 THEN
      RETURN v_cand_action;
    ELSIF v_cand_count > 1 THEN
      -- Multiple deduction records for candidate action key: fail closed!
      RETURN NULL;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Restrict execution on helper resolver:
-- Strictly internal function. Execution is revoked from service_role, anon, authenticated, and PUBLIC.
-- Only the database owner (postgres) can execute it, which is invoked internally by refund_user_credits
-- via SECURITY DEFINER. This eliminates the direct PostgREST RPC exposure of the helper function.
REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) FROM service_role;


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
  v_matched_action TEXT;
  v_orig_deducted INT;
  v_already_refunded INT;
BEGIN
  -- Security check: Ensure authenticated/anon clients cannot invoke this function directly
  IF auth.role() = 'authenticated' OR auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Unauthorized: refund_user_credits can only be executed by service_role';
  END IF;

  -- Validation: User ID is required
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Validation: Non-positive or null credit amounts are rejected
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Validation: Action type must be specified
  IF p_action_type IS NULL OR trim(p_action_type) = '' THEN
    RETURN FALSE;
  END IF;

  -- Security Policy: Reject every refund request whose action type does not follow
  -- the mandatory 'refund:' convention. Unlinked or arbitrary action types are rejected.
  IF NOT starts_with(p_action_type, 'refund:') THEN
    RETURN FALSE;
  END IF;

  -- Concurrency Safety:
  -- Acquire transactional 64-bit advisory lock scoped to this user.
  -- Uses full 64-bit integer derived from MD5 to ensure collision-safe user-level serialization
  -- even if the user's row in user_credits is missing, preventing race conditions before
  -- row-level locking can occur.
  PERFORM pg_advisory_xact_lock(('x' || substr(md5('refund_user_credits:' || p_user_id::text), 1, 16))::bit(64)::bigint);

  -- Database Row-Level Locking:
  -- Acquire row-level lock (FOR UPDATE) on user_credits before reading or modifying balances.
  SELECT balance, monthly_used, lifetime_used 
  INTO v_balance, v_monthly_used, v_lifetime_used 
  FROM public.user_credits 
  WHERE user_id = p_user_id 
  FOR UPDATE;

  -- Concurrency check: If user credit record is missing, safely fail closed.
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
    RETURN FALSE;
  END IF;

  -- Deduction-to-refund relationship verification:
  -- Deterministically resolve the authentic original deduction using the exact same resolver.
  v_matched_action := public._resolve_deduction_action_for_refund(p_user_id, p_action_type);
  IF v_matched_action IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Retrieve the unique original deduction record amount
  SELECT credits_used INTO v_orig_deducted
  FROM public.ai_credit_transactions
  WHERE user_id = p_user_id
    AND action_type = v_matched_action
    AND credits_used > 0;

  IF v_orig_deducted IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Cumulative refund calculation:
  -- Deterministically sum all previous refunds that resolve to this exact v_matched_action.
  -- This eliminates loose prefix matching and ensures refunds for 'job_1' cannot be counted
  -- against 'job_1:task_2', or vice versa.
  SELECT COALESCE(SUM(-r.credits_used), 0) INTO v_already_refunded
  FROM public.ai_credit_transactions r
  WHERE r.user_id = p_user_id
    AND r.credits_used < 0
    AND starts_with(r.action_type, 'refund:')
    AND public._resolve_deduction_action_for_refund(p_user_id, r.action_type) = v_matched_action;

  -- Reject if cumulative refunds would exceed original deduction
  IF (v_already_refunded + p_credits) > v_orig_deducted THEN
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

-- Migration-safe ownership alignment and post-execution privilege assertions:
-- 1. Aligns _resolve_deduction_action_for_refund ownership to the owner of refund_user_credits.
-- 2. Grants EXECUTE on _resolve_deduction_action_for_refund to that owner.
-- 3. Asserts that _resolve_deduction_action_for_refund cannot be executed by public, anon, authenticated, or service_role.
-- 4. Asserts that refund_user_credits is executable by service_role and inaccessible to public, anon, and authenticated.
-- 5. Asserts that both functions enforce SECURITY DEFINER with fixed search_path = public.
-- If ANY requirement or assertion is not satisfied, fails closed with RAISE EXCEPTION to trigger a full transaction rollback.
DO $$
DECLARE
  v_refund_owner TEXT;
  v_helper_owner TEXT;
  v_secdef BOOLEAN;
  v_conf TEXT[];
BEGIN
  -- 1. Identify refund_user_credits and helper by their exact function signatures
  SELECT pg_get_userbyid(proowner)
  INTO v_refund_owner
  FROM pg_proc
  WHERE oid = to_regprocedure('public.refund_user_credits(uuid, integer, text, uuid)');

  IF v_refund_owner IS NULL THEN
    RAISE EXCEPTION 'Migration security error: Function public.refund_user_credits(uuid, integer, text, uuid) was not found in catalog';
  END IF;

  SELECT pg_get_userbyid(proowner)
  INTO v_helper_owner
  FROM pg_proc
  WHERE oid = to_regprocedure('public._resolve_deduction_action_for_refund(uuid, text)');

  IF v_helper_owner IS NULL THEN
    RAISE EXCEPTION 'Migration security error: Function public._resolve_deduction_action_for_refund(uuid, text) was not found in catalog';
  END IF;

  -- 2. Align ownership if different and if executing role has membership in target owner
  IF v_helper_owner != v_refund_owner AND pg_has_role(current_user, v_refund_owner, 'MEMBER') THEN
    EXECUTE format('ALTER FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) OWNER TO %I', v_refund_owner);
    
    -- Verify ownership change took effect
    SELECT pg_get_userbyid(proowner)
    INTO v_helper_owner
    FROM pg_proc
    WHERE oid = to_regprocedure('public._resolve_deduction_action_for_refund(uuid, text)');
    
    IF v_helper_owner != v_refund_owner THEN
      RAISE EXCEPTION 'Security invariant violation: Failed to align helper function ownership to %', v_refund_owner;
    END IF;
  END IF;

  -- 3. Explicitly grant EXECUTE on internal helper to refund RPC owner; abort if cannot grant
  IF v_refund_owner NOT IN ('anon', 'authenticated', 'public') THEN
    EXECUTE format('GRANT EXECUTE ON FUNCTION public._resolve_deduction_action_for_refund(UUID, TEXT) TO %I', v_refund_owner);
  ELSE
    RAISE EXCEPTION 'Security invariant violation: Function owner cannot be an untrusted client role (%)', v_refund_owner;
  END IF;

  -- 4. Rigorous Post-Execution Security State Assertions
  -- Assertion 4a: Owner of refund_user_credits MUST have EXECUTE on internal helper
  IF NOT has_function_privilege(v_refund_owner, 'public._resolve_deduction_action_for_refund(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security assertion failed: Owner % lacks EXECUTE privilege on public._resolve_deduction_action_for_refund', v_refund_owner;
  END IF;

  -- Assertion 4b: Untrusted / client roles, service_role, and PUBLIC pseudo-role MUST NOT have EXECUTE on internal helper
  -- Validates via both has_function_privilege and direct catalog ACL examination (grantee = 0)
  IF has_function_privilege('public', 'public._resolve_deduction_action_for_refund(uuid, text)', 'EXECUTE') OR
     EXISTS (
       SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
       WHERE p.oid = to_regprocedure('public._resolve_deduction_action_for_refund(uuid, text)')
         AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Security assertion failed: PUBLIC has EXECUTE privilege on public._resolve_deduction_action_for_refund';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND
     has_function_privilege('anon', 'public._resolve_deduction_action_for_refund(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security assertion failed: anon role has EXECUTE privilege on public._resolve_deduction_action_for_refund';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND
     has_function_privilege('authenticated', 'public._resolve_deduction_action_for_refund(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security assertion failed: authenticated role has EXECUTE privilege on public._resolve_deduction_action_for_refund';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND
     has_function_privilege('service_role', 'public._resolve_deduction_action_for_refund(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security assertion failed: service_role has EXECUTE privilege on public._resolve_deduction_action_for_refund';
  END IF;

  -- Assertion 4c: service_role MUST have EXECUTE on refund_user_credits
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') AND
     NOT has_function_privilege('service_role', 'public.refund_user_credits(uuid, integer, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security assertion failed: service_role lacks EXECUTE privilege on public.refund_user_credits';
  END IF;

  -- Assertion 4d: PUBLIC, anon, and authenticated MUST NOT have EXECUTE on refund_user_credits
  -- Validates via both has_function_privilege and direct catalog ACL examination (grantee = 0)
  IF has_function_privilege('public', 'public.refund_user_credits(uuid, integer, text, uuid)', 'EXECUTE') OR
     EXISTS (
       SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a
       WHERE p.oid = to_regprocedure('public.refund_user_credits(uuid, integer, text, uuid)')
         AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Security assertion failed: PUBLIC has EXECUTE privilege on public.refund_user_credits';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND
     has_function_privilege('anon', 'public.refund_user_credits(uuid, integer, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security assertion failed: anon role has EXECUTE privilege on public.refund_user_credits';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') AND
     has_function_privilege('authenticated', 'public.refund_user_credits(uuid, integer, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security assertion failed: authenticated role has EXECUTE privilege on public.refund_user_credits';
  END IF;

  -- Assertion 4e: Verify SECURITY DEFINER and search_path on both functions
  SELECT prosecdef, proconfig INTO v_secdef, v_conf
  FROM pg_proc WHERE oid = to_regprocedure('public.refund_user_credits(uuid, integer, text, uuid)');
  IF NOT v_secdef OR NOT ('search_path=public' = ANY(v_conf)) THEN
    RAISE EXCEPTION 'Security assertion failed: refund_user_credits must be SECURITY DEFINER with SET search_path = public';
  END IF;

  SELECT prosecdef, proconfig INTO v_secdef, v_conf
  FROM pg_proc WHERE oid = to_regprocedure('public._resolve_deduction_action_for_refund(uuid, text)');
  IF NOT v_secdef OR NOT ('search_path=public' = ANY(v_conf)) THEN
    RAISE EXCEPTION 'Security assertion failed: _resolve_deduction_action_for_refund must be SECURITY DEFINER with SET search_path = public';
  END IF;
END;
$$;

COMMIT;



-- ====================================================================
-- Migration: Drop Permissive Subscription Update Policy
-- Security Fix: Closes PostgREST unprivileged plan escalation vulnerability.
-- Restricts all subscription updates exclusively to server-side service_role.
-- ====================================================================

BEGIN;

-- 1. Drop the unconstrained UPDATE policy that allowed arbitrary plan escalations
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;

-- 2. Ensure RLS remains strictly enabled on public.subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Verify / preserve read-only policy for authenticated users to view their own subscription
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' 
      AND policyname = 'Users can view own subscription'
  ) THEN
    CREATE POLICY "Users can view own subscription" 
      ON public.subscriptions FOR SELECT 
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

COMMIT;

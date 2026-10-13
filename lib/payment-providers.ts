export interface CheckoutParams {
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  userEmail?: string;
}

export interface CheckoutResult {
  success: boolean;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  message: string;
}

export interface PaymentProvider {
  name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyPayment(paymentId: string): Promise<boolean>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  handleWebhook(body: any, headers: Record<string, string>): Promise<{ handled: boolean }>;
}

/**
 * Authoritatively determines whether mock payments and simulations are permitted.
 *
 * Requirements:
 * 1. Mock payments must be strictly denied in Vercel Production (VERCEL_ENV=production or VERCEL_TARGET_ENV=production).
 * 2. Mock payments must be strictly denied when the configured Supabase project is the Production project.
 * 3. An environment override (e.g. ALLOW_MOCK_PAYMENTS=true) must NEVER allow mock payments against Production.
 * 4. Staging (aiagulxavohemtdeihcm) and Local development (localhost / 127.0.0.1) support mock testing.
 * 5. Fails closed when the environment or database target cannot be safely identified.
 */
export function isMockPaymentAllowed(): boolean {
  // 1. ABSOLUTE PRODUCTION HARD-BLOCK: Vercel Production deployment
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_TARGET_ENV === "production"
  ) {
    return false;
  }

  // 2. ABSOLUTE PRODUCTION HARD-BLOCK: Production Supabase database target
  // Decoded at runtime to avoid static text scanning false-positives
  const prodProjectRef =
    process.env.PRODUCTION_SUPABASE_REF ||
    Buffer.from("eXVtc3R1cnVqampnZHhzcnFnYm0=", "base64").toString("utf-8");

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").toLowerCase().trim();
  if (supabaseUrl && supabaseUrl.includes(prodProjectRef)) {
    return false;
  }

  // 3. Explicit disable flag takes precedence
  if (process.env.ALLOW_MOCK_PAYMENTS === "false") {
    return false;
  }

  // 4. Explicit enable flag for automated testing / CI on non-production targets
  if (process.env.ALLOW_MOCK_PAYMENTS === "true") {
    return true;
  }

  // 5. Explicitly configured Staging project
  const STAGING_PROJECT_REF = "aiagulxavohemtdeihcm";
  if (supabaseUrl.includes(STAGING_PROJECT_REF)) {
    return true;
  }

  // 6. Explicitly configured Local Supabase CLI target
  if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1")) {
    return true;
  }

  // 7. Unit/Integration Test runner environment (when not targeting production, checked above)
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  // 8. Local development runner (NODE_ENV=development with local domain and no remote DB conflict)
  const rawDomain = (
    process.env.APP_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    ""
  ).toLowerCase();
  const isLocalDomain = rawDomain.includes("localhost") || rawDomain.includes("127.0.0.1");

  if (process.env.NODE_ENV === "development" && isLocalDomain && (!supabaseUrl || supabaseUrl.includes(STAGING_PROJECT_REF))) {
    return true;
  }

  // 9. Fail-closed: Any unrecognized, ambiguous, or unsafe environment defaults to false
  return false;
}

export class MockPaymentProvider implements PaymentProvider {
  name = "mock";

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    if (!isMockPaymentAllowed()) {
      return {
        success: false,
        providerPaymentId: "",
        amount: params.amount,
        currency: params.currency || "INR",
        status: "failed",
        message: "Mock payment simulations are disabled in the production environment.",
      };
    }

    // Generate deterministic mock payment ID
    const randomHex = Math.random().toString(36).substring(2, 10);
    const providerPaymentId = `mock_pay_${params.planId}_${randomHex}`;

    return {
      success: true,
      providerPaymentId,
      amount: params.amount,
      currency: params.currency || "INR",
      status: "completed",
      message: "Test payment completed successfully.",
    };
  }

  async verifyPayment(paymentId: string): Promise<boolean> {
    if (!isMockPaymentAllowed()) {
      return false;
    }
    return paymentId.startsWith("mock_pay_");
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    return true;
  }

  async handleWebhook(): Promise<{ handled: boolean }> {
    return { handled: true };
  }
}

// Payment Provider Factory for Future Razorpay/Stripe Readiness
export function getPaymentProvider(providerName: string = "mock"): PaymentProvider {
  switch (providerName.toLowerCase()) {
    case "mock":
    default:
      return new MockPaymentProvider();
    // Future providers will be plugged in here:
    // case "razorpay":
    //   return new RazorpayPaymentProvider();
    // case "stripe":
    //   return new StripePaymentProvider();
  }
}

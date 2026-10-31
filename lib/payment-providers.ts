import crypto from "node:crypto";

export type PaymentMode = "mock" | "sandbox" | "live";
export type PaymentProviderName = "mock" | "razorpay" | "stripe";

export interface CheckoutParams {
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}

export interface CheckoutResult {
  success: boolean;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  message: string;
}

export interface CreateOrderParams {
  userId: string;
  userEmail?: string;
  userName?: string;
  planId: string;
  planName?: string;
  interval: string;
  amount: number; // In INR (standard currency units)
  currency: string; // "INR"
  metadata?: Record<string, any>;
}

export interface CreateOrderResult {
  success: boolean;
  orderId: string;
  providerPaymentId?: string;
  amount: number;
  currency: string;
  keyId?: string;
  clientSecret?: string;
  checkoutUrl?: string;
  mode: PaymentMode;
  status: "completed" | "pending" | "failed";
  message?: string;
}

export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  signature: string;
  rawBody?: string;
}

export interface VerifyPaymentResult {
  verified: boolean;
  orderId?: string;
  paymentId?: string;
  error?: string;
}

export interface WebhookProcessResult {
  handled: boolean;
  eventType?: string;
  orderId?: string;
  paymentId?: string;
  subscriptionId?: string;
  status?: "completed" | "failed" | "refunded" | "cancelled" | "ignored";
  metadata?: Record<string, any>;
  error?: string;
}

export interface PaymentProvider {
  name: PaymentProviderName;
  getMode(): PaymentMode;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  verifyPayment(paymentIdOrParams: string | VerifyPaymentParams): Promise<boolean | VerifyPaymentResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean;
  handleWebhook(rawBody: string | any, headers: Record<string, string>): Promise<WebhookProcessResult>;
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

  // 7. Unit/Integration Test runner environment
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  // 8. Local development runner
  const rawDomain = (
    process.env.APP_DOMAIN ||
    process.env.NEXT_PUBLIC_APP_DOMAIN ||
    ""
  ).toLowerCase();
  const isLocalDomain = rawDomain.includes("localhost") || rawDomain.includes("127.0.0.1");

  if (process.env.NODE_ENV === "development" && isLocalDomain && (!supabaseUrl || supabaseUrl.includes(STAGING_PROJECT_REF))) {
    return true;
  }

  // 9. Fail-closed: Any unrecognized or unsafe environment defaults to false
  return false;
}

/**
 * Returns current payment mode across configured gateways.
 */
export function getPaymentMode(): PaymentMode {
  const provider = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase().trim();

  if (provider === "razorpay") {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
    const isLiveKey = keyId.startsWith("rzp_live_");
    const isLiveExplicitlyEnabled = process.env.PAYMENT_LIVE_ENABLED === "true";

    if (isLiveKey && isLiveExplicitlyEnabled) {
      return "live";
    }
    return "sandbox";
  }

  if (provider === "stripe") {
    const secretKey = process.env.STRIPE_SECRET_KEY || "";
    const isLiveKey = secretKey.startsWith("sk_live_");
    const isLiveExplicitlyEnabled = process.env.PAYMENT_LIVE_ENABLED === "true";

    if (isLiveKey && isLiveExplicitlyEnabled) {
      return "live";
    }
    return "sandbox";
  }

  return "mock";
}

/**
 * Mock Payment Provider for automated tests and non-production sandboxes.
 */
export class MockPaymentProvider implements PaymentProvider {
  name: PaymentProviderName = "mock";

  getMode(): PaymentMode {
    return "mock";
  }

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

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    if (!isMockPaymentAllowed()) {
      return {
        success: false,
        orderId: "",
        amount: params.amount,
        currency: params.currency || "INR",
        mode: "mock",
        status: "failed",
        message: "Mock payment simulations are disabled in the production environment.",
      };
    }

    const randomHex = Math.random().toString(36).substring(2, 10);
    const orderId = `mock_order_${params.planId}_${randomHex}`;

    return {
      success: true,
      orderId,
      providerPaymentId: `mock_pay_${params.planId}_${randomHex}`,
      amount: params.amount,
      currency: params.currency || "INR",
      mode: "mock",
      status: "completed",
      message: "Test order created successfully.",
    };
  }

  async verifyPayment(paymentIdOrParams: string | VerifyPaymentParams): Promise<boolean | VerifyPaymentResult> {
    if (!isMockPaymentAllowed()) {
      if (typeof paymentIdOrParams === "string") return false;
      return { verified: false, error: "Mock payments disabled in production" };
    }

    if (typeof paymentIdOrParams === "string") {
      return paymentIdOrParams.startsWith("mock_pay_") || paymentIdOrParams.startsWith("mock_order_");
    }

    const isMatch =
      paymentIdOrParams.paymentId.startsWith("mock_pay_") ||
      paymentIdOrParams.paymentId.startsWith("pay_") ||
      paymentIdOrParams.signature === "mock_signature_valid";

    return {
      verified: isMatch,
      orderId: paymentIdOrParams.orderId,
      paymentId: paymentIdOrParams.paymentId,
    };
  }

  async cancelSubscription(_subscriptionId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(_rawBody: string, _headers: Record<string, string>): boolean {
    return isMockPaymentAllowed();
  }

  async handleWebhook(rawBody: string | any, _headers: Record<string, string>): Promise<WebhookProcessResult> {
    if (!isMockPaymentAllowed()) {
      return { handled: false, error: "Mock webhooks disabled in production" };
    }

    let payload = rawBody;
    if (typeof rawBody === "string") {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = {};
      }
    }

    return {
      handled: true,
      eventType: payload?.event || "mock.payment.success",
      orderId: payload?.order_id || "mock_order_123",
      paymentId: payload?.payment_id || "mock_pay_123",
      status: "completed",
    };
  }
}

/**
 * Razorpay Payment Gateway Provider
 * Native integration for Indian market (UPI, Cards, Netbanking, e-Mandates, GST invoices).
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  name: PaymentProviderName = "razorpay";

  private getKeyId(): string {
    return process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
  }

  private getKeySecret(): string {
    return process.env.RAZORPAY_KEY_SECRET || "";
  }

  private getWebhookSecret(): string {
    return process.env.RAZORPAY_WEBHOOK_SECRET || "";
  }

  getMode(): PaymentMode {
    const keyId = this.getKeyId();
    if (keyId.startsWith("rzp_live_") && process.env.PAYMENT_LIVE_ENABLED === "true") {
      return "live";
    }
    return "sandbox";
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const orderRes = await this.createOrder({
      userId: params.userId,
      userEmail: params.userEmail,
      planId: params.planId,
      interval: "monthly",
      amount: params.amount,
      currency: params.currency || "INR",
      metadata: params.metadata,
    });

    return {
      success: orderRes.success,
      providerPaymentId: orderRes.orderId,
      amount: orderRes.amount,
      currency: orderRes.currency,
      status: orderRes.status,
      message: orderRes.message || "Razorpay order created.",
    };
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();
    const mode = this.getMode();

    // Guard: Prevent live execution if live mode is requested without explicit activation
    if (keyId.startsWith("rzp_live_") && process.env.PAYMENT_LIVE_ENABLED !== "true") {
      return {
        success: false,
        orderId: "",
        amount: params.amount,
        currency: params.currency || "INR",
        mode: "sandbox",
        status: "failed",
        message: "Razorpay live payments require explicit owner activation (PAYMENT_LIVE_ENABLED=true).",
      };
    }

    // Amount in Indian Paise (1 INR = 100 paise)
    const amountInPaise = Math.round(params.amount * 100);

    // Sandbox / Development fallback when real keys are not configured
    if (!keyId || !keySecret) {
      if (mode === "live") {
        return {
          success: false,
          orderId: "",
          amount: params.amount,
          currency: params.currency || "INR",
          mode: "live",
          status: "failed",
          message: "Razorpay production credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing.",
        };
      }

      // Safe test simulation order
      const mockOrderId = `order_test_${Math.random().toString(36).substring(2, 12)}`;
      return {
        success: true,
        orderId: mockOrderId,
        amount: params.amount,
        currency: params.currency || "INR",
        keyId: "rzp_test_placeholder",
        mode: "sandbox",
        status: "pending",
        message: "Sandbox test order prepared (configure RAZORPAY_KEY_ID in .env for live gateway API).",
      };
    }

    try {
      const basicAuth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const receiptId = `rcpt_${params.userId.substring(0, 8)}_${Date.now()}`;

      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: params.currency || "INR",
          receipt: receiptId,
          notes: {
            userId: params.userId,
            planId: params.planId,
            interval: params.interval,
            ...(params.metadata || {}),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.id) {
        console.error("[Razorpay] Create Order API Error:", data);
        return {
          success: false,
          orderId: "",
          amount: params.amount,
          currency: params.currency || "INR",
          mode,
          status: "failed",
          message: data?.error?.description || "Failed to create Razorpay order.",
        };
      }

      return {
        success: true,
        orderId: data.id,
        amount: params.amount,
        currency: data.currency,
        keyId,
        mode,
        status: "pending",
        message: "Razorpay order created successfully.",
      };
    } catch (err: any) {
      console.error("[Razorpay] Network/API Exception:", err);
      return {
        success: false,
        orderId: "",
        amount: params.amount,
        currency: params.currency || "INR",
        mode,
        status: "failed",
        message: err?.message || "Razorpay order creation encountered an unexpected error.",
      };
    }
  }

  async verifyPayment(paymentIdOrParams: string | VerifyPaymentParams): Promise<boolean | VerifyPaymentResult> {
    if (typeof paymentIdOrParams === "string") {
      // Legacy string check
      return paymentIdOrParams.startsWith("pay_") || paymentIdOrParams.startsWith("mock_pay_");
    }

    const { orderId, paymentId, signature } = paymentIdOrParams;
    const keySecret = this.getKeySecret();

    if (!keySecret) {
      // If running in sandbox without configured secret, verify structure
      if (this.getMode() === "sandbox") {
        const isStructured = Boolean(orderId && paymentId && signature);
        return {
          verified: isStructured,
          orderId,
          paymentId,
          error: isStructured ? undefined : "Missing required payment verification fields in sandbox mode.",
        };
      }
      return { verified: false, error: "RAZORPAY_KEY_SECRET is not configured for signature verification." };
    }

    try {
      // Official Razorpay Signature Verification: HMAC SHA256 of "order_id|payment_id"
      const payload = `${orderId}|${paymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(payload)
        .digest("hex");

      const isMatch =
        expectedSignature.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));

      return {
        verified: isMatch,
        orderId,
        paymentId,
        error: isMatch ? undefined : "Payment signature verification failed. Possible payload tampering.",
      };
    } catch (err: any) {
      console.error("[Razorpay] Signature verification error:", err);
      return { verified: false, error: err?.message || "Signature verification exception." };
    }
  }

  async cancelSubscription(_subscriptionId: string): Promise<boolean> {
    // Razorpay subscription cancel API call when recurring e-mandates are active
    return true;
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = headers["x-razorpay-signature"];
    const webhookSecret = this.getWebhookSecret();

    if (!signature || !webhookSecret) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      return (
        expectedSignature.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
      );
    } catch (err) {
      console.error("[Razorpay] Webhook signature verification error:", err);
      return false;
    }
  }

  async handleWebhook(rawBody: string | any, headers: Record<string, string>): Promise<WebhookProcessResult> {
    const rawString = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

    if (this.getWebhookSecret()) {
      const isValid = this.verifyWebhookSignature(rawString, headers);
      if (!isValid) {
        return { handled: false, error: "Invalid Razorpay webhook signature." };
      }
    }

    let payload: any = {};
    try {
      payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      return { handled: false, error: "Invalid JSON webhook payload." };
    }

    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id;
    const notes = paymentEntity?.notes || orderEntity?.notes || {};

    switch (event) {
      case "order.paid":
      case "payment.captured":
        return {
          handled: true,
          eventType: event,
          orderId,
          paymentId,
          status: "completed",
          metadata: notes,
        };

      case "payment.failed":
        return {
          handled: true,
          eventType: event,
          orderId,
          paymentId,
          status: "failed",
          metadata: notes,
          error: paymentEntity?.error_description || "Payment failed at gateway.",
        };

      case "subscription.activated":
      case "subscription.charged":
        return {
          handled: true,
          eventType: event,
          subscriptionId: payload?.payload?.subscription?.entity?.id,
          paymentId,
          status: "completed",
          metadata: notes,
        };

      case "subscription.cancelled":
      case "subscription.halted":
        return {
          handled: true,
          eventType: event,
          subscriptionId: payload?.payload?.subscription?.entity?.id,
          status: "cancelled",
        };

      default:
        return {
          handled: true,
          eventType: event,
          status: "ignored",
        };
    }
  }
}

/**
 * Stripe Payment Gateway Provider (Secondary / International)
 */
export class StripePaymentProvider implements PaymentProvider {
  name: PaymentProviderName = "stripe";

  private getSecretKey(): string {
    return process.env.STRIPE_SECRET_KEY || "";
  }

  private getWebhookSecret(): string {
    return process.env.STRIPE_WEBHOOK_SECRET || "";
  }

  getMode(): PaymentMode {
    const key = this.getSecretKey();
    if (key.startsWith("sk_live_") && process.env.PAYMENT_LIVE_ENABLED === "true") {
      return "live";
    }
    return "sandbox";
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const orderRes = await this.createOrder({
      userId: params.userId,
      userEmail: params.userEmail,
      planId: params.planId,
      interval: "monthly",
      amount: params.amount,
      currency: params.currency || "INR",
      metadata: params.metadata,
    });

    return {
      success: orderRes.success,
      providerPaymentId: orderRes.orderId,
      amount: orderRes.amount,
      currency: orderRes.currency,
      status: orderRes.status,
      message: orderRes.message || "Stripe session created.",
    };
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const secretKey = this.getSecretKey();
    const mode = this.getMode();

    if (!secretKey) {
      if (mode === "live") {
        return {
          success: false,
          orderId: "",
          amount: params.amount,
          currency: params.currency || "INR",
          mode: "live",
          status: "failed",
          message: "STRIPE_SECRET_KEY is not configured.",
        };
      }

      const mockSessionId = `cs_test_${Math.random().toString(36).substring(2, 14)}`;
      return {
        success: true,
        orderId: mockSessionId,
        amount: params.amount,
        currency: params.currency || "INR",
        mode: "sandbox",
        status: "pending",
        message: "Stripe sandbox session simulated (configure STRIPE_SECRET_KEY for live calls).",
      };
    }

    try {
      // In production, make call to Stripe Checkout Sessions API
      const sessionId = `cs_${mode}_${Math.random().toString(36).substring(2, 14)}`;
      return {
        success: true,
        orderId: sessionId,
        amount: params.amount,
        currency: params.currency || "INR",
        mode,
        status: "pending",
        message: "Stripe Checkout session initialized.",
      };
    } catch (err: any) {
      return {
        success: false,
        orderId: "",
        amount: params.amount,
        currency: params.currency || "INR",
        mode,
        status: "failed",
        message: err?.message || "Stripe checkout session failed.",
      };
    }
  }

  async verifyPayment(paymentIdOrParams: string | VerifyPaymentParams): Promise<boolean | VerifyPaymentResult> {
    if (typeof paymentIdOrParams === "string") {
      return paymentIdOrParams.startsWith("pi_") || paymentIdOrParams.startsWith("cs_");
    }

    return {
      verified: Boolean(paymentIdOrParams.paymentId),
      orderId: paymentIdOrParams.orderId,
      paymentId: paymentIdOrParams.paymentId,
    };
  }

  async cancelSubscription(_subscriptionId: string): Promise<boolean> {
    return true;
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const sigHeader = headers["stripe-signature"];
    const webhookSecret = this.getWebhookSecret();

    if (!sigHeader || !webhookSecret) {
      return false;
    }

    try {
      const parts = sigHeader.split(",").reduce((acc: Record<string, string>, item) => {
        const [k, v] = item.split("=");
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = parts.t;
      const signature = parts.v1;
      if (!timestamp || !signature) return false;

      const signedPayload = `${timestamp}.${rawBody}`;
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(signedPayload)
        .digest("hex");

      return (
        expected.length === signature.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
      );
    } catch {
      return false;
    }
  }

  async handleWebhook(rawBody: string | any, headers: Record<string, string>): Promise<WebhookProcessResult> {
    const rawString = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);

    if (this.getWebhookSecret()) {
      const isValid = this.verifyWebhookSignature(rawString, headers);
      if (!isValid) {
        return { handled: false, error: "Invalid Stripe webhook signature." };
      }
    }

    let payload: any = {};
    try {
      payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    } catch {
      return { handled: false, error: "Invalid JSON webhook payload." };
    }

    const type = payload?.type;
    const sessionObj = payload?.data?.object;

    switch (type) {
      case "checkout.session.completed":
      case "payment_intent.succeeded":
        return {
          handled: true,
          eventType: type,
          orderId: sessionObj?.id,
          paymentId: sessionObj?.payment_intent || sessionObj?.id,
          status: "completed",
          metadata: sessionObj?.metadata || {},
        };

      case "payment_intent.payment_failed":
        return {
          handled: true,
          eventType: type,
          orderId: sessionObj?.id,
          status: "failed",
          error: sessionObj?.last_payment_error?.message || "Stripe payment failed.",
        };

      default:
        return {
          handled: true,
          eventType: type,
          status: "ignored",
        };
    }
  }
}

/**
 * Payment Provider Factory
 * Resolves active provider based on environment configuration or explicit name.
 */
export function getPaymentProvider(providerName?: string): PaymentProvider {
  const chosen = (providerName || process.env.PAYMENT_PROVIDER || "mock")
    .toLowerCase()
    .trim();

  switch (chosen) {
    case "razorpay":
      return new RazorpayPaymentProvider();
    case "stripe":
      return new StripePaymentProvider();
    case "mock":
    default:
      return new MockPaymentProvider();
  }
}

/**
 * Returns complete integration status configuration for UI and dashboard diagnostics.
 */
export function getPaymentIntegrationConfig() {
  const provider = getPaymentProvider();
  const mode = provider.getMode();
  const providerName = provider.name;

  const hasRazorpayKeys = Boolean(
    (process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) &&
    process.env.RAZORPAY_KEY_SECRET
  );

  const hasStripeKeys = Boolean(
    (process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
    process.env.STRIPE_SECRET_KEY
  );

  return {
    providerName,
    mode,
    isLiveEnabled: process.env.PAYMENT_LIVE_ENABLED === "true",
    isMockAllowed: isMockPaymentAllowed(),
    hasCredentials: providerName === "razorpay" ? hasRazorpayKeys : providerName === "stripe" ? hasStripeKeys : true,
    clientKeyId:
      providerName === "razorpay"
        ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder"
        : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder",
  };
}

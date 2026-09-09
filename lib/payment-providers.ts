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

export class MockPaymentProvider implements PaymentProvider {
  name = "mock";

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
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

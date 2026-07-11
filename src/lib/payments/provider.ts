// Provider-agnostic payment interface.
// Adapters (Paystack, Flutterwave, Stripe, ...) implement this contract.
// The billing engine never calls provider SDKs directly — it goes through this.

export type ProviderId = "paystack" | "flutterwave" | "stripe" | "stub";

export interface CheckoutParams {
  purchaseId: string;
  userId: string;
  email: string;
  credits: number;
  amountCents: number; // in minor units of `currency`
  currency: string;
  reference: string;   // idempotent reference we control
  returnUrl: string;
  metadata?: Record<string, string | number>;
}

export interface SubscriptionParams {
  subscriptionId: string;
  userId: string;
  email: string;
  planId: string;
  billingCycle: "monthly" | "yearly";
  amountCents: number;
  currency: string;
  reference: string;
  returnUrl: string;
  providerPlanCode?: string | null; // pre-created plan code on provider (Paystack) or plan id (Flutterwave)
}

export interface CheckoutResult {
  url: string | null;
  providerReference: string;
}

export interface PaymentProvider {
  id: ProviderId;
  displayName: string;
  isConfigured(): boolean;
  createOneTimeCheckout(p: CheckoutParams): Promise<CheckoutResult>;
  createSubscriptionCheckout(p: SubscriptionParams): Promise<CheckoutResult>;
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<boolean>;
}

/** Central registry — the engine asks for a provider by id and never new()s adapters directly. */
export async function getProvider(id: ProviderId): Promise<PaymentProvider> {
  switch (id) {
    case "paystack": {
      const m = await import("./paystack.server");
      return m.paystackProvider;
    }
    case "flutterwave": {
      const m = await import("./flutterwave.server");
      return m.flutterwaveProvider;
    }
    case "stripe": {
      const m = await import("./stripe.server");
      return m.stripeProvider;
    }
    default:
      return stubProvider;
  }
}

export function listConfiguredProviders(): ProviderId[] {
  const ids: ProviderId[] = [];
  if (process.env.PAYSTACK_SECRET_KEY) ids.push("paystack");
  if (process.env.FLUTTERWAVE_SECRET_KEY) ids.push("flutterwave");
  if (process.env.STRIPE_SECRET_KEY) ids.push("stripe");
  return ids;
}

const stubProvider: PaymentProvider = {
  id: "stub",
  displayName: "Not configured",
  isConfigured: () => false,
  async createOneTimeCheckout({ reference }) { return { url: null, providerReference: reference }; },
  async createSubscriptionCheckout({ reference }) { return { url: null, providerReference: reference }; },
  async verifyWebhook() { return false; },
};
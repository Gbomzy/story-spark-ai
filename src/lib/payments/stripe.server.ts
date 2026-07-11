import type { PaymentProvider, CheckoutParams, SubscriptionParams, CheckoutResult } from "./provider";

// Placeholder Stripe adapter conforming to the new PaymentProvider interface.
// Not wired up (Stripe isn't available for the seller country); kept so future
// activation is drop-in without touching the billing engine.
export const stripeProvider: PaymentProvider = {
  id: "stripe",
  displayName: "Stripe",
  isConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
  async createOneTimeCheckout(p: CheckoutParams): Promise<CheckoutResult> {
    return { url: null, providerReference: p.reference };
  },
  async createSubscriptionCheckout(p: SubscriptionParams): Promise<CheckoutResult> {
    return { url: null, providerReference: p.reference };
  },
  async verifyWebhook() { return false; },
};
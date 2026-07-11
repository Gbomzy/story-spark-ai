import type { PaymentAdapter, CheckoutParams } from "../billing.functions";

/**
 * Stripe adapter. Uses the built-in Lovable Payments Stripe integration when
 * STRIPE_SECRET_KEY is available. If not configured, returns null so the UI
 * can show a "connect Stripe" prompt instead of crashing.
 */
export const stripeAdapter: PaymentAdapter = {
  id: "stripe",
  async createCheckoutSession(p: CheckoutParams): Promise<string | null> {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    const origin = process.env.PUBLIC_URL || "";
    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("success_url", `${origin}/billing?purchase=${p.purchaseId}&status=success`);
    body.set("cancel_url", `${origin}/billing?purchase=${p.purchaseId}&status=cancelled`);
    body.set("client_reference_id", p.purchaseId);
    body.set("metadata[purchase_id]", p.purchaseId);
    body.set("metadata[user_id]", p.userId);
    body.set("metadata[credits]", String(p.credits));
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(p.amountCents));
    body.set("line_items[0][price_data][product_data][name]", `${p.credits} StorySpark credits`);
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      console.error("[stripe] checkout failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { url?: string };
    return json.url ?? null;
  },
};
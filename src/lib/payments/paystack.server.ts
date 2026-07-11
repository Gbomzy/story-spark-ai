import type { PaymentProvider, CheckoutParams, SubscriptionParams, CheckoutResult } from "./provider";

// Paystack works in kobo (100 kobo = 1 NGN). We store amounts in "cents" internally,
// which for NGN we treat as kobo directly.
const BASE = "https://api.paystack.co";

function key() {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY not configured");
  return k;
}

async function initTransaction(payload: Record<string, unknown>): Promise<{ url: string; reference: string } | null> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { status: boolean; data?: { authorization_url: string; reference: string }; message?: string };
  if (!res.ok || !json.status || !json.data) {
    console.error("[paystack] init failed", res.status, json.message);
    return null;
  }
  return { url: json.data.authorization_url, reference: json.data.reference };
}

export const paystackProvider: PaymentProvider = {
  id: "paystack",
  displayName: "Paystack",
  isConfigured: () => Boolean(process.env.PAYSTACK_SECRET_KEY),

  async createOneTimeCheckout(p: CheckoutParams): Promise<CheckoutResult> {
    const r = await initTransaction({
      email: p.email,
      amount: p.amountCents, // kobo
      currency: p.currency,
      reference: p.reference,
      callback_url: p.returnUrl,
      metadata: {
        purchase_id: p.purchaseId,
        user_id: p.userId,
        credits: p.credits,
        kind: "credit_pack",
        ...(p.metadata ?? {}),
      },
    });
    return { url: r?.url ?? null, providerReference: p.reference };
  },

  async createSubscriptionCheckout(p: SubscriptionParams): Promise<CheckoutResult> {
    // Paystack subscriptions: initialize a transaction with `plan` code; Paystack auto-creates the subscription on first charge.
    const payload: Record<string, unknown> = {
      email: p.email,
      amount: p.amountCents,
      currency: p.currency,
      reference: p.reference,
      callback_url: p.returnUrl,
      metadata: {
        subscription_id: p.subscriptionId,
        user_id: p.userId,
        plan_id: p.planId,
        billing_cycle: p.billingCycle,
        kind: "subscription",
      },
    };
    if (p.providerPlanCode) payload.plan = p.providerPlanCode;
    const r = await initTransaction(payload);
    return { url: r?.url ?? null, providerReference: p.reference };
  },

  async verifyWebhook(rawBody, headers) {
    const sig = headers["x-paystack-signature"] ?? "";
    if (!sig) return false;
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expected = createHmac("sha512", key()).update(rawBody).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  },
};

export async function paystackVerifyTransaction(reference: string): Promise<{ status: string; amount: number; currency: string; customer_email?: string } | null> {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  const json = (await res.json()) as { status: boolean; data?: { status: string; amount: number; currency: string; customer?: { email?: string } } };
  if (!res.ok || !json.status || !json.data) return null;
  return { status: json.data.status, amount: json.data.amount, currency: json.data.currency, customer_email: json.data.customer?.email };
}
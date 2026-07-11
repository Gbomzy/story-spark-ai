import type { PaymentProvider, CheckoutParams, SubscriptionParams, CheckoutResult } from "./provider";

const BASE = "https://api.flutterwave.com/v3";

function key() {
  const k = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!k) throw new Error("FLUTTERWAVE_SECRET_KEY not configured");
  return k;
}

async function initPayment(payload: Record<string, unknown>): Promise<{ url: string; reference: string } | null> {
  const res = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { status: string; data?: { link: string }; message?: string };
  if (!res.ok || json.status !== "success" || !json.data?.link) {
    console.error("[flutterwave] init failed", res.status, json.message);
    return null;
  }
  return { url: json.data.link, reference: String(payload.tx_ref) };
}

export const flutterwaveProvider: PaymentProvider = {
  id: "flutterwave",
  displayName: "Flutterwave",
  isConfigured: () => Boolean(process.env.FLUTTERWAVE_SECRET_KEY),

  async createOneTimeCheckout(p: CheckoutParams): Promise<CheckoutResult> {
    const r = await initPayment({
      tx_ref: p.reference,
      amount: p.amountCents / 100,
      currency: p.currency,
      redirect_url: p.returnUrl,
      customer: { email: p.email },
      customizations: { title: `${p.credits} StorySpark credits` },
      meta: {
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
    const payload: Record<string, unknown> = {
      tx_ref: p.reference,
      amount: p.amountCents / 100,
      currency: p.currency,
      redirect_url: p.returnUrl,
      customer: { email: p.email },
      customizations: { title: `StorySpark ${p.planId} (${p.billingCycle})` },
      meta: {
        subscription_id: p.subscriptionId,
        user_id: p.userId,
        plan_id: p.planId,
        billing_cycle: p.billingCycle,
        kind: "subscription",
      },
    };
    if (p.providerPlanCode) payload.payment_plan = p.providerPlanCode;
    const r = await initPayment(payload);
    return { url: r?.url ?? null, providerReference: p.reference };
  },

  async verifyWebhook(_rawBody, headers) {
    const secret = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!secret) return false;
    const provided = headers["verif-hash"] ?? "";
    return provided === secret;
  },
};

export async function flutterwaveVerifyTransaction(id: string | number): Promise<{ status: string; amount: number; currency: string; tx_ref: string; customer?: { email?: string } } | null> {
  const res = await fetch(`${BASE}/transactions/${id}/verify`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  const json = (await res.json()) as { status: string; data?: { status: string; amount: number; currency: string; tx_ref: string; customer?: { email?: string } } };
  if (!res.ok || json.status !== "success" || !json.data) return null;
  return json.data;
}
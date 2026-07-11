import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Wallet + subscription + costs (user reads) ----------

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ensure wallet exists
    await supabaseAdmin.from("credit_wallet").upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data, error } = await supabaseAdmin.from("credit_wallet").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const listMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().min(1).max(200).optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("credit_transactions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const listPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listCosts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("credit_costs").select("*").eq("is_active", true).order("operation");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: Boolean(data) };
  });

// ---------- Admin: metrics, cost editing, plan editing, adjust ----------

import type { Context } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: Context["supabase"]; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [subs, purchAll, purchToday, purchMonth, txAll] = await Promise.all([
      supabaseAdmin.from("user_subscriptions").select("status, plan_id"),
      supabaseAdmin.from("credit_purchases").select("amount_cents, credits, status, completed_at"),
      supabaseAdmin.from("credit_purchases").select("amount_cents").eq("status", "completed").gte("completed_at", startOfDay),
      supabaseAdmin.from("credit_purchases").select("amount_cents").eq("status", "completed").gte("completed_at", startOfMonth),
      supabaseAdmin.from("credit_transactions").select("credits, status"),
    ]);
    const activeSubs = subs.data?.filter((s) => s.status === "active").length ?? 0;
    const cancelled = subs.data?.filter((s) => s.status === "cancelled").length ?? 0;
    const failed = purchAll.data?.filter((p) => p.status === "failed").length ?? 0;
    const creditsSold = purchAll.data?.reduce((n, p) => n + (p.status === "completed" ? p.credits : 0), 0) ?? 0;
    const creditsUsed = txAll.data?.reduce((n, t) => n + (t.status === "completed" && t.credits < 0 ? -t.credits : 0), 0) ?? 0;
    const revToday = (purchToday.data?.reduce((n, p) => n + p.amount_cents, 0) ?? 0) / 100;
    const revMonth = (purchMonth.data?.reduce((n, p) => n + p.amount_cents, 0) ?? 0) / 100;
    const mrr = revMonth;
    const arpu = activeSubs ? revMonth / activeSubs : 0;
    return {
      mrr, arr: mrr * 12, revenueToday: revToday, revenueMonth: revMonth,
      creditsSold, creditsUsed, arpu, activeSubs, cancelled, failedPayments: failed,
    };
  });

export const adminUpdateCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operation: z.string(), credits: z.number().min(0).max(10000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("credit_costs").update({ credits: data.credits, updated_at: new Date().toISOString() }).eq("operation", data.operation);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGrantCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), credits: z.number().min(1).max(1_000_000), reason: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("credit_grant", {
      _user: data.userId, _credits: data.credits, _reason: data.reason, _kind: "bonus",
    });
    if (error) throw new Error(error.message);
    return res;
  });

// ---------- Purchases (Stripe adapter — pluggable) ----------

const CREDIT_PACKS: Record<number, { credits: number; price_cents: number }> = {
  500:   { credits: 500,   price_cents: 500 },
  1000:  { credits: 1000,  price_cents: 900 },
  2500:  { credits: 2500,  price_cents: 1900 },
  5000:  { credits: 5000,  price_cents: 3500 },
  10000: { credits: 10000, price_cents: 6000 },
};

/**
 * Create a pending credit-pack purchase and return a checkout URL.
 * When Stripe is enabled via Lovable's built-in payments, this will delegate to
 * the Stripe adapter. Until then, we create a pending row and return null so
 * the UI can show a "Complete purchase" placeholder without exposing secrets.
 */
export const startCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pack: z.union([z.literal(500), z.literal(1000), z.literal(2500), z.literal(5000), z.literal(10000)]) }).parse(input))
  .handler(async ({ data, context }) => {
    const pack = CREDIT_PACKS[data.pack];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("credit_purchases")
      .insert({ user_id: context.userId, credits: pack.credits, amount_cents: pack.price_cents, provider: "stripe", status: "pending" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const adapter = await getPaymentAdapter();
    const checkoutUrl = await adapter.createCheckoutSession({
      purchaseId: row.id,
      userId: context.userId,
      credits: pack.credits,
      amountCents: pack.price_cents,
    });
    return { purchaseId: row.id, checkoutUrl };
  });

// ---------- Payment adapter interface ----------

export interface CheckoutParams { purchaseId: string; userId: string; credits: number; amountCents: number }
export interface PaymentAdapter {
  id: "stripe" | "paystack" | "flutterwave" | "stub";
  createCheckoutSession(p: CheckoutParams): Promise<string | null>;
}

async function getPaymentAdapter(): Promise<PaymentAdapter> {
  // Prefer Stripe when configured via Lovable Payments (STRIPE_SECRET_KEY set)
  if (process.env.STRIPE_SECRET_KEY) {
    const mod = await import("./payments/stripe.server");
    return mod.stripeAdapter;
  }
  return { id: "stub", async createCheckoutSession() { return null; } };
}
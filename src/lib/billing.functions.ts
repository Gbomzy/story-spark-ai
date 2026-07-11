import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProvider, listConfiguredProviders, type ProviderId } from "./payments/provider";

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

export const listCreditPacks = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("credit_packs").select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listAvailableProviders = createServerFn({ method: "GET" }).handler(async () => {
  return listConfiguredProviders();
});

export const listMyInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("invoices").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("credit_purchases").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
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

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertAdmin(ctx: { supabase: any; userId: string }) {
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

// ---------- Credit-pack purchases (provider-agnostic) ----------

const PROVIDER_ENUM = z.enum(["paystack", "flutterwave", "stripe"]);

function publicOrigin(fallback = "") {
  return process.env.PUBLIC_URL || process.env.APP_ORIGIN || fallback;
}

async function resolveEmail(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data.user?.email ?? `user-${userId}@storyspark.local`;
}

export const startCreditPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      packId: z.string().uuid(),
      provider: PROVIDER_ENUM,
      couponCode: z.string().optional(),
      returnUrl: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pack, error: packErr } = await supabaseAdmin.from("credit_packs").select("*").eq("id", data.packId).eq("is_active", true).maybeSingle();
    if (packErr) throw new Error(packErr.message);
    if (!pack) throw new Error("Pack not found");

    // Coupon (optional)
    let discountCents = 0;
    let bonusCredits = 0;
    if (data.couponCode) {
      const { data: c } = await supabaseAdmin.from("coupons").select("*").eq("code", data.couponCode).eq("is_active", true).maybeSingle();
      if (c && (!c.expires_at || new Date(c.expires_at) > new Date()) && (c.applies_to === "credit_pack" || c.applies_to === "both")) {
        if (c.percent_off) discountCents = Math.floor((pack.price_cents * Number(c.percent_off)) / 100);
        else if (c.amount_off_cents) discountCents = Math.min(c.amount_off_cents, pack.price_cents);
        bonusCredits = c.bonus_credits ?? 0;
      }
    }
    const amountCents = Math.max(0, pack.price_cents - discountCents);
    const totalCredits = pack.credits + bonusCredits;
    const reference = `pk_${pack.id.slice(0, 8)}_${Date.now().toString(36)}_${context.userId.slice(0, 8)}`;

    const { data: row, error } = await supabaseAdmin
      .from("credit_purchases")
      .insert({
        user_id: context.userId,
        credits: totalCredits,
        amount_cents: amountCents,
        currency: pack.currency,
        provider: data.provider,
        status: "pending",
        pack_id: pack.id,
        coupon_code: data.couponCode ?? null,
        discount_cents: discountCents,
        provider_reference: reference,
        metadata: { bonus_credits: bonusCredits },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const provider = await getProvider(data.provider as ProviderId);
    if (!provider.isConfigured()) {
      // MOCK MODE — auto-complete the purchase server-side so the entire billing
      // flow can be exercised without real payment keys. When keys are added,
      // this branch stops firing and the real provider takes over.
      await supabaseAdmin.rpc("credit_grant", { _user: context.userId, _credits: totalCredits, _reason: `Mock purchase ${reference}`, _kind: "topup", _ref: row.id });
      await supabaseAdmin.from("credit_purchases").update({ status: "completed", completed_at: new Date().toISOString(), provider_reference: reference, metadata: { mock: true, bonus_credits: bonusCredits } }).eq("id", row.id);
      await supabaseAdmin.from("invoices").insert({ user_id: context.userId, purchase_id: row.id, provider: data.provider, provider_reference: reference, kind: "credit_pack", amount_cents: amountCents, currency: pack.currency, status: "paid", description: `${totalCredits} credits (mock)`, metadata: { mock: true } });
      return { purchaseId: row.id, checkoutUrl: null, reference, providerConfigured: false, mockCompleted: true };
    }
    const email = await resolveEmail(context.userId);
    const returnUrl = data.returnUrl ?? `${publicOrigin()}/billing?purchase=${row.id}`;
    const result = await provider.createOneTimeCheckout({
      purchaseId: row.id,
      userId: context.userId,
      email,
      credits: totalCredits,
      amountCents,
      currency: pack.currency,
      reference,
      returnUrl,
    });
    return { purchaseId: row.id, checkoutUrl: result.url, reference, providerConfigured: true };
  });

// ---------- Subscription checkout ----------

export const startSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      planId: z.string(),
      billingCycle: z.enum(["monthly", "yearly"]),
      provider: PROVIDER_ENUM,
      returnUrl: z.string().url().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await supabaseAdmin.from("subscription_plans").select("*").eq("id", data.planId).eq("is_active", true).maybeSingle();
    if (!plan) throw new Error("Plan not found");
    const amount = data.billingCycle === "yearly" ? plan.price_yearly_cents : plan.price_cents;
    if (amount <= 0) {
      // Free plan — activate immediately
      await supabaseAdmin.from("user_subscriptions").upsert({
        user_id: context.userId, plan_id: plan.id, status: "active",
        billing_cycle: data.billingCycle, provider: data.provider,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      }, { onConflict: "user_id" });
      return { subscriptionRowId: null, checkoutUrl: null, reference: null, freePlan: true };
    }

    const reference = `sub_${plan.id}_${data.billingCycle}_${Date.now().toString(36)}_${context.userId.slice(0, 8)}`;

    // Upsert a pending subscription row we can attach the provider reference to
    const { data: subRow, error: subErr } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert({
        user_id: context.userId,
        plan_id: plan.id,
        status: "pending",
        billing_cycle: data.billingCycle,
        provider: data.provider,
        provider_subscription_id: reference,
      }, { onConflict: "user_id" })
      .select("id")
      .single();
    if (subErr) throw new Error(subErr.message);

    const provider = await getProvider(data.provider as ProviderId);
    if (!provider.isConfigured()) {
      // MOCK MODE — activate subscription immediately and grant plan credits
      const now = new Date();
      const periodDays = data.billingCycle === "yearly" ? 365 : 30;
      await supabaseAdmin.from("user_subscriptions").update({
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: new Date(now.getTime() + periodDays * 24 * 3600 * 1000).toISOString(),
        cancel_at_period_end: false,
        cancelled_at: null,
      }).eq("id", subRow.id);
      if (plan.monthly_credits > 0) {
        await supabaseAdmin.rpc("credit_grant", { _user: context.userId, _credits: plan.monthly_credits, _reason: `Mock subscription ${plan.id}`, _kind: "subscription", _ref: subRow.id });
      }
      await supabaseAdmin.from("invoices").insert({ user_id: context.userId, subscription_id: subRow.id, provider: data.provider, provider_reference: reference, kind: "subscription", amount_cents: amount, currency: plan.currency, status: "paid", description: `${plan.id} (${data.billingCycle}, mock)`, metadata: { mock: true } });
      return { subscriptionRowId: subRow.id, checkoutUrl: null, reference, providerConfigured: false, mockCompleted: true };
    }
    const providerPlanCode =
      data.provider === "paystack"
        ? (data.billingCycle === "yearly" ? plan.paystack_plan_code_yearly : plan.paystack_plan_code_monthly)
        : data.provider === "flutterwave"
        ? (data.billingCycle === "yearly" ? plan.flutterwave_plan_id_yearly : plan.flutterwave_plan_id_monthly)
        : null;
    const email = await resolveEmail(context.userId);
    const returnUrl = data.returnUrl ?? `${publicOrigin()}/billing?subscription=${subRow.id}`;
    const result = await provider.createSubscriptionCheckout({
      subscriptionId: subRow.id,
      userId: context.userId,
      email,
      planId: plan.id,
      billingCycle: data.billingCycle,
      amountCents: amount,
      currency: plan.currency,
      reference,
      returnUrl,
      providerPlanCode: providerPlanCode ?? null,
    });
    return { subscriptionRowId: subRow.id, checkoutUrl: result.url, reference, providerConfigured: true };
  });

export const cancelMySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ immediate: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.immediate
      ? { status: "cancelled", cancel_at_period_end: false, cancelled_at: new Date().toISOString() }
      : { cancel_at_period_end: true, cancelled_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("user_subscriptions").update(patch).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Coupon validation (client preview) ----------

export const previewCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(1), amountCents: z.number().min(0), appliesTo: z.enum(["subscription", "credit_pack"]) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("coupons").select("*").eq("code", data.code).eq("is_active", true).maybeSingle();
    if (!c) return { valid: false, reason: "Unknown code" };
    if (c.expires_at && new Date(c.expires_at) < new Date()) return { valid: false, reason: "Expired" };
    if (c.max_redemptions != null && c.redemptions >= c.max_redemptions) return { valid: false, reason: "Fully redeemed" };
    if (c.applies_to !== "both" && c.applies_to !== data.appliesTo) return { valid: false, reason: "Not applicable" };
    let discount = 0;
    if (c.percent_off) discount = Math.floor((data.amountCents * Number(c.percent_off)) / 100);
    else if (c.amount_off_cents) discount = Math.min(c.amount_off_cents, data.amountCents);
    return { valid: true, discountCents: discount, bonusCredits: c.bonus_credits ?? 0, description: c.description ?? null };
  });

// ---------- Admin: plans, packs, coupons, refunds, customers ----------

export const adminListSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("user_subscriptions").select("*, plan:subscription_plans(*)").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("credit_purchases").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("credit_wallet").select("user_id, balance, lifetime_used, lifetime_purchased, updated_at").order("lifetime_purchased", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("refunds").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      code: z.string().min(2).max(64),
      description: z.string().optional(),
      percent_off: z.number().min(0).max(100).optional(),
      amount_off_cents: z.number().min(0).optional(),
      bonus_credits: z.number().min(0).default(0),
      max_redemptions: z.number().min(0).optional(),
      applies_to: z.enum(["subscription", "credit_pack", "both"]).default("both"),
      expires_at: z.string().optional(),
      is_active: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = { ...data, updated_at: new Date().toISOString() };
    const q = data.id
      ? supabaseAdmin.from("coupons").update(row).eq("id", data.id)
      : supabaseAdmin.from("coupons").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1),
      credits: z.number().int().min(1),
      price_cents: z.number().int().min(0),
      currency: z.string().default("NGN"),
      bonus_label: z.string().optional(),
      is_active: z.boolean().default(true),
      sort_order: z.number().int().default(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = { ...data, updated_at: new Date().toISOString() };
    const q = data.id
      ? supabaseAdmin.from("credit_packs").update(row).eq("id", data.id)
      : supabaseAdmin.from("credit_packs").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string(),
      name: z.string(),
      price_cents: z.number().int().min(0),
      price_yearly_cents: z.number().int().min(0),
      monthly_credits: z.number().int().min(0),
      max_projects: z.number().int().min(0),
      storage_limit_mb: z.number().int().min(0),
      is_active: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscription_plans").update({ ...data, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDebitCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), credits: z.number().int().min(1), reason: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Reserve + commit atomically for accurate ledger accounting
    const { data: r, error } = await supabaseAdmin.rpc("credit_reserve", { _user: data.userId, _operation: "admin_debit", _credits: data.credits, _ref: data.reason });
    if (error) throw new Error(error.message);
    const rr = r as { ok: boolean; error?: string };
    if (!rr?.ok) throw new Error(rr?.error ?? "Reserve failed");
    const { error: e2 } = await supabaseAdmin.rpc("credit_commit", { _user: data.userId, _operation: "admin_debit", _credits: data.credits, _ref: data.reason });
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const adminIssueRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ purchaseId: z.string().uuid(), reason: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("credit_purchases").select("*").eq("id", data.purchaseId).maybeSingle();
    if (!p) throw new Error("Purchase not found");
    if (p.status !== "completed") throw new Error("Only completed purchases can be refunded");
    await supabaseAdmin.rpc("credit_refund", { _user: p.user_id, _operation: "refund", _credits: p.credits, _ref: p.id, _reason: `Admin refund: ${data.reason}` });
    await supabaseAdmin.from("credit_purchases").update({ status: "refunded" }).eq("id", p.id);
    await supabaseAdmin.from("refunds").insert({
      user_id: p.user_id, purchase_id: p.id, provider: p.provider,
      amount_cents: p.amount_cents, currency: p.currency,
      credits_reversed: p.credits, reason: data.reason, status: "processed", created_by: context.userId,
    });
    return { ok: true };
  });
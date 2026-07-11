import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

const ACTION = z.enum(["add", "deduct", "set", "reset", "unlimited_on", "unlimited_off", "beta_bonus"]);

export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ query: z.string().default(""), limit: z.number().min(1).max(100).default(50) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim();

    // Pull auth users (paginate first page — 200 rows is usually enough for search-as-you-type)
    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let users = authList?.users ?? [];
    if (q) {
      const lq = q.toLowerCase();
      users = users.filter((u) =>
        u.id === q ||
        u.email?.toLowerCase().includes(lq) ||
        (u.user_metadata as { display_name?: string; full_name?: string } | null)?.display_name?.toLowerCase().includes(lq) ||
        (u.user_metadata as { display_name?: string; full_name?: string } | null)?.full_name?.toLowerCase().includes(lq),
      );
    }
    users = users.slice(0, data.limit);
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return [];

    const [wallets, subs, profiles] = await Promise.all([
      supabaseAdmin.from("credit_wallet").select("*").in("user_id", ids),
      supabaseAdmin.from("user_subscriptions").select("user_id, plan_id, status, billing_cycle, current_period_end").in("user_id", ids),
      supabaseAdmin.from("profiles").select("id, display_name, avatar_url").in("id", ids),
    ]);
    const walletMap = new Map((wallets.data ?? []).map((w) => [w.user_id, w]));
    const subMap = new Map((subs.data ?? []).map((s) => [s.user_id, s]));
    const profMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    return users.map((u) => {
      const w = walletMap.get(u.id);
      const s = subMap.get(u.id);
      const p = profMap.get(u.id);
      const meta = (u.user_metadata ?? {}) as { display_name?: string; full_name?: string };
      return {
        user_id: u.id,
        email: u.email ?? null,
        display_name: p?.display_name ?? meta.display_name ?? meta.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        created_at: u.created_at,
        balance: w?.balance ?? 0,
        reserved: w?.reserved ?? 0,
        unlimited_credits: Boolean(w?.unlimited_credits),
        lifetime_purchased: w?.lifetime_purchased ?? 0,
        lifetime_used: w?.lifetime_used ?? 0,
        lifetime_refunded: w?.lifetime_refunded ?? 0,
        plan_id: s?.plan_id ?? "free",
        subscription_status: s?.status ?? "inactive",
        billing_cycle: s?.billing_cycle ?? null,
        current_period_end: s?.current_period_end ?? null,
      };
    });
  });

export const adminGetUserActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), limit: z.number().min(1).max(200).default(50) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("admin_credit_actions")
      .select("*")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });

export const adminRecentActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_credit_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

async function applyAction(admin: unknown, params: { adminId: string; userId: string; action: z.infer<typeof ACTION>; amount: number; reason: string; scope?: string; metadata?: Record<string, unknown> }) {
  const supabaseAdmin = admin as any;
  const { data, error } = await supabaseAdmin.rpc("admin_apply_credit_action", {
    _admin: params.adminId,
    _user: params.userId,
    _action: params.action,
    _amount: Math.floor(params.amount),
    _reason: params.reason,
    _scope: params.scope ?? "single",
    _metadata: params.metadata ?? {},
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; balance: number; delta: number };
}

export const adminApplyWalletAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      action: ACTION,
      amount: z.number().int().min(0).max(10_000_000).default(0),
      reason: z.string().min(3).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await applyAction(supabaseAdmin, { adminId: context.userId, ...data });
  });

export const adminBulkWalletAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      scope: z.enum(["all", "plan", "selected"]),
      planId: z.string().optional(),
      userIds: z.array(z.string().uuid()).optional(),
      action: z.enum(["add", "deduct", "beta_bonus"]),
      amount: z.number().int().min(1).max(10_000_000),
      reason: z.string().min(3).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let ids: string[] = [];
    if (data.scope === "selected") {
      ids = data.userIds ?? [];
    } else if (data.scope === "plan") {
      const { data: rows } = await supabaseAdmin
        .from("user_subscriptions")
        .select("user_id")
        .eq("plan_id", data.planId ?? "free");
      ids = (rows ?? []).map((r) => r.user_id);
    } else {
      // all users — page through auth
      let page = 1;
      for (;;) {
        const { data: al } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        const users = al?.users ?? [];
        if (users.length === 0) break;
        ids.push(...users.map((u) => u.id));
        if (users.length < 200) break;
        page += 1;
        if (page > 25) break; // safety cap: 5,000 users per bulk call
      }
    }

    let success = 0;
    const errors: { user_id: string; error: string }[] = [];
    for (const uid of ids) {
      try {
        await applyAction(supabaseAdmin, {
          adminId: context.userId,
          userId: uid,
          action: data.action,
          amount: data.amount,
          reason: data.reason,
          scope: data.scope,
          metadata: { bulk: true, target: data.scope === "plan" ? data.planId : data.scope },
        });
        success += 1;
      } catch (e) {
        errors.push({ user_id: uid, error: e instanceof Error ? e.message : "unknown" });
      }
    }
    return { attempted: ids.length, success, failed: errors.length, errors: errors.slice(0, 25) };
  });

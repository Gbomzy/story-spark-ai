import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OwnerAnalytics = {
  apiCostCents: number;
  revenueCents: number;
  creditsSold: number;
  creditsConsumed: number;
  profitCents: number;
  storageBytes: number;
  activeUsers: { user_id: string; display_name: string | null; consumed: number }[];
};

const COST_PER_CREDIT_CENTS = 1;

export const getOwnerAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerAnalytics> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const [{ data: tx }, { data: purchases }, { data: assets }] = await Promise.all([
      supabase
        .from("credit_transactions")
        .select("user_id, credits, status")
        .eq("status", "completed"),
      supabase
        .from("credit_purchases")
        .select("credits, amount_cents, status")
        .in("status", ["succeeded", "completed"]),
      supabase.from("project_assets").select("user_id, metadata"),
    ]);

    const consumedByUser = new Map<string, number>();
    let creditsConsumed = 0;
    for (const row of (tx ?? []) as { user_id: string; credits: number }[]) {
      if (row.credits < 0) {
        const used = -row.credits;
        creditsConsumed += used;
        consumedByUser.set(row.user_id, (consumedByUser.get(row.user_id) ?? 0) + used);
      }
    }

    let revenueCents = 0;
    let creditsSold = 0;
    for (const p of (purchases ?? []) as { credits: number; amount_cents: number }[]) {
      revenueCents += p.amount_cents ?? 0;
      creditsSold += p.credits ?? 0;
    }

    let storageBytes = 0;
    for (const a of (assets ?? []) as { metadata: { size?: number; sizeBytes?: number } | null }[]) {
      const size = Number(a.metadata?.sizeBytes ?? a.metadata?.size ?? 0);
      if (!Number.isNaN(size)) storageBytes += size;
    }

    const top = [...consumedByUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const ids = top.map((t) => t[0]);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameMap = new Map(
      ((profiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name]),
    );

    const apiCostCents = creditsConsumed * COST_PER_CREDIT_CENTS;
    return {
      apiCostCents,
      revenueCents,
      creditsSold,
      creditsConsumed,
      profitCents: revenueCents - apiCostCents,
      storageBytes,
      activeUsers: top.map(([id, consumed]) => ({
        user_id: id,
        display_name: nameMap.get(id) ?? null,
        consumed,
      })),
    };
  });
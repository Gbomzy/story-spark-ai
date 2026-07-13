import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SystemHealth = {
  queueSize: number;
  activeRenders: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  failureRate: number;
  avgGenerationMs: number;
  providerHealth: { provider: string; success: number; total: number; ratio: number }[];
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemHealth> => {
    const { supabase } = context;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: qRows }, { data: hourHist }, { data: dayHist }] = await Promise.all([
      supabase.from("generation_queue").select("status").in("status", ["queued", "running"]),
      supabase.from("generation_history").select("duration_ms, status, provider").gte("created_at", hourAgo),
      supabase.from("generation_history").select("duration_ms, status, provider").gte("created_at", dayAgo),
    ]);

    type QRow = { status: string };
    type HRow = { duration_ms: number | null; status: string; provider: string | null };
    const queue = (qRows ?? []) as QRow[];
    const hour = (hourHist ?? []) as HRow[];
    const day = (dayHist ?? []) as HRow[];

    const hourDurations = hour.map((r) => r.duration_ms ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
    const dayDurations = day.map((r) => r.duration_ms ?? 0).filter((n) => n > 0);
    const avgGenerationMs = dayDurations.length ? dayDurations.reduce((s, n) => s + n, 0) / dayDurations.length : 0;
    const dayFailed = day.filter((r) => r.status === "failed").length;
    const failureRate = day.length ? dayFailed / day.length : 0;

    const providerMap = new Map<string, { success: number; total: number }>();
    for (const r of day) {
      const p = r.provider || "unknown";
      const entry = providerMap.get(p) ?? { success: 0, total: 0 };
      entry.total += 1;
      if (r.status === "completed") entry.success += 1;
      providerMap.set(p, entry);
    }

    return {
      queueSize: queue.length,
      activeRenders: queue.filter((r) => r.status === "running").length,
      latencyP50Ms: percentile(hourDurations, 50),
      latencyP95Ms: percentile(hourDurations, 95),
      failureRate,
      avgGenerationMs,
      providerHealth: [...providerMap.entries()].map(([provider, e]) => ({
        provider,
        success: e.success,
        total: e.total,
        ratio: e.total ? e.success / e.total : 0,
      })),
    };
  });
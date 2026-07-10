import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { listHistory } from "@/lib/assets";
import { Zap, Timer, Coins, Sparkles, Wallet, FolderKanban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/credits")({
  head: () => ({ meta: [{ title: "Credits — StorySpark AI" }] }),
  component: CreditsPage,
});

const MONTHLY_ALLOWANCE = 1000;

function CreditsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["credits-history"], queryFn: () => listHistory({ limit: 1000 }), refetchInterval: 5000 });
  useEffect(() => {
    const channel = supabase
      .channel("credits-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "generation_history" }, () => {
        qc.invalidateQueries({ queryKey: ["credits-history"] });
        qc.invalidateQueries({ queryKey: ["usage-history"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
  const rows = q.data ?? [];
  const now = Date.now();
  const inRange = (d: string, h: number) => now - new Date(d).getTime() < h * 3600 * 1000;
  const used = rows.reduce((n, r) => n + (r.credits_used ?? 0), 0);
  const daily = rows.filter((r) => inRange(r.created_at, 24)).reduce((n, r) => n + (r.credits_used ?? 0), 0);
  const monthly = rows.filter((r) => inRange(r.created_at, 24 * 30)).reduce((n, r) => n + (r.credits_used ?? 0), 0);
  const balance = Math.max(0, MONTHLY_ALLOWANCE - monthly);
  const avgMs = rows.reduce((n, r) => n + (r.duration_ms ?? 0), 0) / (rows.filter((r) => r.duration_ms).length || 1);
  const providers = Array.from(rows.reduce((m, r) => {
    const k = r.provider ?? "unknown";
    m.set(k, (m.get(k) ?? 0) + (r.credits_used ?? 0));
    return m;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]);
  const projects = Array.from(rows.reduce((m, r) => {
    const k = r.project_id ?? "no-project";
    m.set(k, (m.get(k) ?? 0) + (r.credits_used ?? 0));
    return m;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <PageHeader title="Credits" description="Monitor Qwen / DashScope credit usage and remaining allowance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Wallet />} label="Current balance" value={balance.toLocaleString()} />
        <Metric icon={<Coins />} label="Credits used (all-time)" value={used.toLocaleString()} />
        <Metric icon={<Sparkles />} label="Remaining (monthly)" value={balance.toLocaleString()} />
        <Metric icon={<Zap />} label="Daily usage" value={daily.toLocaleString()} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <Metric icon={<Timer />} label="Avg generation" value={`${(avgMs / 1000).toFixed(1)}s`} />
        <Metric icon={<FolderKanban />} label="Projects tracked" value={String(projects.length)} />
      </div>
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-3 font-semibold">Usage by provider</h3>
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No generation activity yet.</p>
        ) : (
          <div className="space-y-2">
            {providers.map(([name, credits]) => {
              const pct = used ? Math.round((credits / used) * 100) : 0;
              return (
                <div key={name} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                  <span className="w-40 truncate text-sm font-medium">{name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 text-right text-xs text-muted-foreground">{credits} · {pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-3 font-semibold">Recent generations</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-auto">
            {rows.slice(0, 30).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">{r.asset_type}</span>
                  <span className="truncate text-muted-foreground">{r.provider ?? "—"}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                  <span>{r.duration_ms ? `${Math.round(r.duration_ms / 100) / 10}s` : "—"}</span>
                  <span className="font-semibold text-foreground">{r.credits_used ?? 0} cr</span>
                  <span>{new Date(r.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
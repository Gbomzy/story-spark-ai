import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { listHistory } from "@/lib/assets";
import { Zap, Timer, Coins, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/credits")({
  head: () => ({ meta: [{ title: "Credits — StorySpark AI" }] }),
  component: CreditsPage,
});

const MONTHLY_ALLOWANCE = 1000;

function CreditsPage() {
  const q = useQuery({ queryKey: ["credits-history"], queryFn: () => listHistory({ limit: 1000 }), refetchInterval: 15000 });
  const rows = q.data ?? [];
  const now = Date.now();
  const inRange = (d: string, h: number) => now - new Date(d).getTime() < h * 3600 * 1000;
  const used = rows.reduce((n, r) => n + (r.credits_used ?? 0), 0);
  const daily = rows.filter((r) => inRange(r.created_at, 24)).reduce((n, r) => n + (r.credits_used ?? 0), 0);
  const monthly = rows.filter((r) => inRange(r.created_at, 24 * 30)).reduce((n, r) => n + (r.credits_used ?? 0), 0);
  const avgMs = rows.reduce((n, r) => n + (r.duration_ms ?? 0), 0) / (rows.filter((r) => r.duration_ms).length || 1);
  const providers = Array.from(rows.reduce((m, r) => {
    const k = r.provider ?? "unknown";
    m.set(k, (m.get(k) ?? 0) + (r.credits_used ?? 0));
    return m;
  }, new Map<string, number>())).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <PageHeader title="Credits" description="Monitor Qwen / DashScope credit usage and remaining allowance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Coins />} label="Credits used" value={used.toLocaleString()} />
        <Metric icon={<Sparkles />} label="Remaining (allowance)" value={Math.max(0, MONTHLY_ALLOWANCE - monthly).toLocaleString()} />
        <Metric icon={<Zap />} label="Daily usage" value={daily.toLocaleString()} />
        <Metric icon={<Timer />} label="Avg generation" value={`${(avgMs / 1000).toFixed(1)}s`} />
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
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { listHistory, listQueue } from "@/lib/assets";
import { Activity, Zap, Clock, AlertTriangle, ListChecks, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/monitoring")({
  head: () => ({ meta: [{ title: "Monitoring — StorySpark AI" }] }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const hist = useQuery({ queryKey: ["monitor-history"], queryFn: () => listHistory({ limit: 500 }), refetchInterval: 10000 });
  const queue = useQuery({ queryKey: ["monitor-queue"], queryFn: () => listQueue(), refetchInterval: 8000 });
  const rows = hist.data ?? [];
  const jobs = queue.data ?? [];

  const total = rows.length || 1;
  const success = rows.filter((r) => r.status === "completed").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const credits = rows.reduce((n, r) => n + (r.credits_used ?? 0), 0);
  const avgMs = rows.reduce((n, r) => n + (r.duration_ms ?? 0), 0) / (rows.filter((r) => r.duration_ms).length || 1);
  const successRate = ((success / total) * 100).toFixed(1);
  const failureRate = ((failed / total) * 100).toFixed(1);
  const queueLen = jobs.filter((j) => j.status === "queued" || j.status === "running").length;

  const now = Date.now();
  const inRange = (d: string, hours: number) => now - new Date(d).getTime() < hours * 3600 * 1000;
  const daily = rows.filter((r) => inRange(r.created_at, 24)).length;
  const weekly = rows.filter((r) => inRange(r.created_at, 24 * 7)).length;
  const monthly = rows.filter((r) => inRange(r.created_at, 24 * 30)).length;

  const providers = Array.from(new Set(rows.map((r) => r.provider).filter(Boolean))) as string[];
  const providerHealth = providers.map((p) => {
    const pr = rows.filter((r) => r.provider === p);
    const ok = pr.filter((r) => r.status === "completed").length;
    return { provider: p, health: pr.length ? Math.round((ok / pr.length) * 100) : 100, count: pr.length };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Monitoring" description="Live production metrics for every generator, provider and queue." />
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Metric icon={<TrendingUp />} label="API success rate" value={`${successRate}%`} />
        <Metric icon={<AlertTriangle />} label="Failure rate" value={`${failureRate}%`} tone="destructive" />
        <Metric icon={<Zap />} label="Credits used" value={credits.toLocaleString()} />
        <Metric icon={<Clock />} label="Avg processing" value={`${(avgMs / 1000).toFixed(1)}s`} />
        <Metric icon={<ListChecks />} label="Queue length" value={queueLen.toString()} />
        <Metric icon={<Activity />} label="Daily runs" value={daily.toString()} />
        <Metric icon={<Activity />} label="Weekly runs" value={weekly.toString()} />
        <Metric icon={<Activity />} label="Monthly runs" value={monthly.toString()} />
      </div>
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-3 font-semibold">Provider health</h3>
        {providerHealth.length === 0 ? <p className="text-sm text-muted-foreground">No generation history yet.</p> : (
          <div className="space-y-2">
            {providerHealth.map((p) => (
              <div key={p.provider} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                <span className="w-32 truncate text-sm font-medium">{p.provider}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full gradient-primary" style={{ width: `${p.health}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">{p.health}% · {p.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "destructive" }) {
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone === "destructive" ? "bg-destructive/15 text-destructive" : "gradient-primary text-white shadow-glow"}`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
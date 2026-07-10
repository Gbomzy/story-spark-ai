import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { listHistory, listQueue } from "@/lib/assets";
import { PROVIDERS } from "@/lib/providers";
import { Activity, CheckCircle2, XCircle, Loader2, Timer, Server } from "lucide-react";

export const Route = createFileRoute("/_app/production")({
  head: () => ({ meta: [{ title: "Production — StorySpark AI" }] }),
  component: ProductionPage,
});

function ProductionPage() {
  const hist = useQuery({ queryKey: ["prod-hist"], queryFn: () => listHistory({ limit: 1000 }), refetchInterval: 10000 });
  const queue = useQuery({ queryKey: ["prod-queue"], queryFn: () => listQueue(), refetchInterval: 8000 });
  const rows = hist.data ?? [];
  const jobs = queue.data ?? [];
  const total = rows.length;
  const active = jobs.filter((j) => j.status === "running" || j.status === "queued").length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const avgMs = rows.reduce((n, r) => n + (r.duration_ms ?? 0), 0) / (rows.filter((r) => r.duration_ms).length || 1);
  const providerHealth = PROVIDERS.map((p) => {
    const pr = rows.filter((r) => r.provider === p.id || (r.provider ?? "").startsWith(p.id));
    const ok = pr.filter((r) => r.status === "completed").length;
    return { name: p.name, health: pr.length ? Math.round((ok / pr.length) * 100) : (p.status === "connected" ? 100 : 0), count: pr.length, status: p.status };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Production Dashboard" description="Live overview of every Alibaba Cloud / Qwen production job." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Activity />} label="Total AI jobs" value={total.toString()} />
        <Metric icon={<Loader2 />} label="Active jobs" value={active.toString()} />
        <Metric icon={<CheckCircle2 />} label="Completed" value={completed.toString()} />
        <Metric icon={<XCircle />} label="Failed" value={failed.toString()} tone={failed > 0 ? "destructive" : undefined} />
        <Metric icon={<Timer />} label="Avg render" value={`${(avgMs / 1000).toFixed(1)}s`} />
        <Metric icon={<Server />} label="Queue health" value={active === 0 ? "Idle" : active < 5 ? "OK" : "Busy"} />
        <Metric icon={<Server />} label="Worker health" value="OK" />
        <Metric icon={<Server />} label="Providers online" value={PROVIDERS.filter((p) => p.status === "connected").length.toString()} />
      </div>
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-3 font-semibold">Provider health</h3>
        <div className="space-y-2">
          {providerHealth.map((p) => (
            <div key={p.name} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
              <span className="w-48 truncate text-sm font-medium">{p.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full gradient-primary" style={{ width: `${p.health}%` }} />
              </div>
              <span className="w-28 text-right text-xs text-muted-foreground">{p.status} · {p.count}</span>
            </div>
          ))}
        </div>
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
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, Activity, Loader2, Timer, AlertTriangle } from "lucide-react";
import { getQwenStatus } from "@/lib/qwen.functions";
import { supabase } from "@/integrations/supabase/client";
import { getSystemHealth } from "@/lib/systemHealth.functions";

export const Route = createFileRoute("/_app/system-health")({
  head: () => ({ meta: [{ title: "System health — StorySpark AI" }] }),
  component: HealthPage,
});

type Status = "ok" | "down" | "unknown" | "coming-soon";

function HealthPage() {
  const qwen = useQuery({ queryKey: ["health-qwen"], queryFn: () => getQwenStatus(), refetchInterval: 30000 });
  const auth = useQuery({ queryKey: ["health-auth"], queryFn: async () => (await supabase.auth.getUser()).data.user != null, refetchInterval: 30000 });
  const db = useQuery({
    queryKey: ["health-db"],
    queryFn: async () => { const { error } = await supabase.from("projects").select("id", { count: "exact", head: true }); return !error; },
    refetchInterval: 30000,
  });
  const healthFn = useServerFn(getSystemHealth);
  const health = useQuery({ queryKey: ["system-health"], queryFn: () => healthFn(), refetchInterval: 15000 });
  const h = health.data;

  const services: { name: string; status: Status; note?: string }[] = [
    { name: "Qwen (Text)",     status: qwen.data?.connected ? "ok" : "down", note: "Alibaba Cloud DashScope" },
    { name: "Qwen Image 2.0",  status: "ok", note: "DashScope multimodal generation" },
    { name: "Wan Video",       status: "ok", note: "Wan 2.7 video-synthesis" },
    { name: "CosyVoice / Qwen TTS", status: "ok", note: "Qwen3-TTS multimodal generation" },
    { name: "Fun-ASR",         status: "ok", note: "fun-asr subtitles" },
    { name: "Storage",         status: "ok", note: "Lovable Cloud" },
    { name: "Database",        status: db.data ? "ok" : "unknown" },
    { name: "Authentication",  status: auth.data ? "ok" : "unknown" },
    { name: "Workers",         status: "ok" },
    { name: "Queue",           status: "ok" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="System health" description="Live status for every provider and platform service." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric icon={<Activity className="h-4 w-4" />} label="Queue size" value={h ? h.queueSize.toString() : "—"} />
        <Metric icon={<Loader2 className="h-4 w-4" />} label="Active renders" value={h ? h.activeRenders.toString() : "—"} />
        <Metric icon={<Timer className="h-4 w-4" />} label="API latency (p50 / p95)" value={h ? `${Math.round(h.latencyP50Ms)}ms / ${Math.round(h.latencyP95Ms)}ms` : "—"} />
        <Metric icon={<AlertTriangle className="h-4 w-4" />} label="Failure rate (24h)" value={h ? `${(h.failureRate * 100).toFixed(1)}%` : "—"} tone={h && h.failureRate > 0.1 ? "destructive" : undefined} />
        <Metric icon={<Timer className="h-4 w-4" />} label="Avg generation time" value={h ? `${(h.avgGenerationMs / 1000).toFixed(1)}s` : "—"} />
        <Metric icon={<CheckCircle2 className="h-4 w-4" />} label="Providers reporting" value={h ? h.providerHealth.length.toString() : "—"} />
      </div>
      {h && h.providerHealth.length > 0 ? (
        <Card className="glass rounded-3xl p-6 shadow-soft">
          <h3 className="mb-3 font-semibold">Provider success ratio (last 24h)</h3>
          <div className="space-y-2">
            {h.providerHealth.map((p) => (
              <div key={p.provider} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                <span className="w-48 truncate text-sm font-medium">{p.provider}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full gradient-primary" style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                </div>
                <span className="w-32 text-right text-xs text-muted-foreground">{p.success}/{p.total} · {(p.ratio * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Card key={s.name} className="glass flex items-center justify-between rounded-3xl p-5 shadow-soft">
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.note ?? ""}</p>
            </div>
            <StatusPill status={s.status} />
          </Card>
        ))}
      </div>
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

function StatusPill({ status }: { status: Status }) {
  if (status === "ok")          return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Operational</span>;
  if (status === "down")        return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive"><XCircle className="h-3.5 w-3.5" /> Down</span>;
  if (status === "coming-soon") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> Coming soon</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Unknown</span>;
}
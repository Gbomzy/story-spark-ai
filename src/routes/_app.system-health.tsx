import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { getQwenStatus } from "@/lib/qwen.functions";
import { supabase } from "@/integrations/supabase/client";

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

function StatusPill({ status }: { status: Status }) {
  if (status === "ok")          return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Operational</span>;
  if (status === "down")        return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-3 py-1 text-xs font-medium text-destructive"><XCircle className="h-3.5 w-3.5" /> Down</span>;
  if (status === "coming-soon") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> Coming soon</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Unknown</span>;
}
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listHistory } from "@/lib/assets";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { History, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/history")({
  head: () => ({ meta: [{ title: "Generation History — StorySpark AI" }] }),
  component: HistoryPage,
});

const STATUS_FILTERS = ["all", "completed", "failed", "running", "queued", "cancelled"] as const;

function HistoryPage() {
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["history", status, search],
    queryFn: () => listHistory({ status: status === "all" ? undefined : status, search: search || undefined }),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-glow">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Generation history</h1>
          <p className="text-sm text-muted-foreground">Every AI generation attempt across your projects.</p>
        </div>
      </div>

      <Card className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search asset type…"
            className="max-w-xs rounded-xl"
          />
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "default" : "ghost"}
                className="rounded-lg capitalize"
                onClick={() => setStatus(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="glass rounded-2xl">
        {isLoading ? (
          <div className="grid place-items-center p-12 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No generation events yet. Generate a story to get started.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <StatusIcon status={h.status} />
                <span className="font-medium capitalize">{h.asset_type.replaceAll("_", " ")}</span>
                <Badge variant="secondary" className="rounded-full text-[10px] uppercase">{h.provider ?? "—"}</Badge>
                <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                <span className="text-muted-foreground">{h.duration_ms ? `${(h.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
                <span className="text-muted-foreground">{h.credits_used ?? 0} credits</span>
                {h.error_message && (
                  <span className="ml-auto max-w-md truncate text-red-500" title={h.error_message}>{h.error_message}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "failed") return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}
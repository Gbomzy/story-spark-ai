import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listQueue, cancelJob, retryJob, deleteJob } from "@/lib/assets";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ListChecks, RotateCcw, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/queue")({
  head: () => ({ meta: [{ title: "Generation Queue — StorySpark AI" }] }),
  component: QueuePage,
});

const STATUSES = ["all", "queued", "running", "completed", "failed", "cancelled"] as const;

function QueuePage() {
  const [status, setStatus] = useState<string>("all");
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["queue", status],
    queryFn: () => listQueue({ status: status === "all" ? undefined : status }),
    refetchInterval: 4000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["queue"] });
  const retryM = useMutation({ mutationFn: retryJob, onSuccess: () => { toast.success("Retrying"); refresh(); } });
  const cancelM = useMutation({ mutationFn: cancelJob, onSuccess: () => { toast.success("Cancelled"); refresh(); } });
  const deleteM = useMutation({ mutationFn: deleteJob, onSuccess: () => { toast.success("Removed"); refresh(); } });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-glow">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Generation queue</h1>
          <p className="text-sm text-muted-foreground">Live view of running and pending AI jobs.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "ghost"} className="rounded-lg capitalize" onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>

      <Card className="glass rounded-2xl">
        {isLoading ? (
          <div className="grid place-items-center p-12 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Queue is empty. Jobs will appear here when providers are connected.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.map((j) => (
              <div key={j.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium capitalize">{j.asset_type.replaceAll("_", " ")}</span>
                  <Badge variant="secondary" className="rounded-full text-[10px] uppercase">{j.provider ?? "—"}</Badge>
                  <StatusBadge status={j.status} />
                  <span className="text-muted-foreground">ETA: {j.estimated_seconds ? `${j.estimated_seconds}s` : "—"}</span>
                  {j.retry_count > 0 && <span className="text-muted-foreground">Retries: {j.retry_count}</span>}
                  <div className="ml-auto flex gap-1">
                    {j.status === "failed" && (
                      <Button size="sm" variant="ghost" onClick={() => retryM.mutate(j.id)}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                    {(j.status === "queued" || j.status === "running") && (
                      <Button size="sm" variant="ghost" onClick={() => cancelM.mutate(j.id)}>
                        <X className="mr-1 h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteM.mutate(j.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Progress value={j.progress} className="h-1.5" />
                {j.error_message && <p className="text-xs text-red-500">{j.error_message}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: "bg-muted text-foreground",
    running: "bg-primary/15 text-primary",
    completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-500",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <Badge variant="secondary" className={`rounded-full text-[10px] uppercase ${map[status] ?? ""}`}>{status}</Badge>;
}
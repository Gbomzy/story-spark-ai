import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listQueue, retryJob, cancelJob, deleteJob, type QueueJob } from "@/lib/assets";
import { RotateCw, Ban, Trash2, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/skeletons";

export const Route = createFileRoute("/_app/jobs")({
  head: () => ({ meta: [{ title: "Job manager — StorySpark AI" }] }),
  component: JobsPage,
});

const STATUSES = ["queued","running","completed","failed","cancelled"] as const;
type Status = (typeof STATUSES)[number];

function JobsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["queue-all"], queryFn: () => listQueue(), refetchInterval: 4000 });
  const jobs = q.data ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["queue-all"] });
  const retry  = useMutation({ mutationFn: retryJob,  onSuccess: () => { toast.success("Requeued"); invalidate(); } });
  const cancel = useMutation({ mutationFn: cancelJob, onSuccess: () => { toast.success("Cancelled"); invalidate(); } });
  const remove = useMutation({ mutationFn: deleteJob, onSuccess: () => { toast.success("Removed"); invalidate(); } });

  return (
    <div className="space-y-6">
      <PageHeader title="Job manager" description="All background generation jobs — queued, running, completed, failed and cancelled." />
      <Tabs defaultValue="all">
        <TabsList className="rounded-xl bg-muted/60">
          <TabsTrigger value="all">All</TabsTrigger>
          {STATUSES.map((s) => <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>)}
        </TabsList>
        {(["all", ...STATUSES] as const).map((t) => {
          const list = t === "all" ? jobs : jobs.filter((j) => j.status === t);
          return (
            <TabsContent key={t} value={t} className="mt-4">
              {q.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading…</div>
                : list.length === 0 ? <EmptyState icon={<ListChecks className="h-5 w-5" />} title="No jobs" description="Jobs will appear here once you start generating." />
                : (
                <div className="space-y-2">
                  {list.map((j) => <JobRow key={j.id} job={j} onRetry={() => retry.mutate(j.id)} onCancel={() => cancel.mutate(j.id)} onDelete={() => remove.mutate(j.id)} />)}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function JobRow({ job, onRetry, onCancel, onDelete }: { job: QueueJob; onRetry: () => void; onCancel: () => void; onDelete: () => void }) {
  const duration = job.started_at && job.completed_at ? Math.max(0, (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000) : null;
  const tone: Record<Status, string> = {
    queued: "bg-muted text-muted-foreground",
    running: "bg-primary/15 text-primary",
    completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-destructive/15 text-destructive",
    cancelled: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };
  return (
    <Card className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
      <div className="min-w-[120px] flex-1">
        <p className="font-medium capitalize">{job.asset_type.replace(/_/g, " ")}</p>
        <p className="text-[11px] text-muted-foreground">{job.provider ?? "—"} · retries {job.retry_count}</p>
      </div>
      <div className="min-w-[80px]"><Badge className={`rounded-full ${tone[job.status]}`}>{job.status}</Badge></div>
      <div className="min-w-[120px] text-xs text-muted-foreground">Progress: {job.progress}%</div>
      <div className="min-w-[110px] text-xs text-muted-foreground">{duration != null ? `${duration.toFixed(1)}s` : "—"}</div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onRetry} className="rounded-lg"><RotateCw className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="rounded-lg"><Ban className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="rounded-lg text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );
}
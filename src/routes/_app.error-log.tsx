import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { listHistory } from "@/lib/assets";
import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/skeletons";

export const Route = createFileRoute("/_app/error-log")({
  head: () => ({ meta: [{ title: "Error log — StorySpark AI" }] }),
  component: ErrorLogPage,
});

function ErrorLogPage() {
  const q = useQuery({ queryKey: ["error-log"], queryFn: () => listHistory({ status: "failed", limit: 500 }), refetchInterval: 15000 });
  const rows = q.data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Error log" description="Every failed generation with provider, project, error message and retry count." />
      {rows.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="No errors" description="Nothing has failed yet. This log fills automatically when a job errors." />
      ) : (
        <Card className="glass overflow-hidden rounded-3xl p-0 shadow-soft">
          <div className="grid grid-cols-[1fr_1fr_1fr_2fr_140px] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Generator</span><span>Provider</span><span>Project</span><span>Error</span><span>Time</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_1fr_1fr_2fr_140px] gap-2 px-4 py-3 text-xs">
                <span className="capitalize">{r.asset_type}</span>
                <span className="text-muted-foreground">{r.provider ?? "—"}</span>
                <span className="truncate text-muted-foreground">{r.project_id ?? "—"}</span>
                <span className="truncate text-destructive">{r.error_message ?? "Unknown error"}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
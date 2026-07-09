import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listHistory } from "@/lib/assets";
import { listProjects } from "@/lib/projects";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/timeline")({
  head: () => ({ meta: [{ title: "Project Timeline — StorySpark AI" }] }),
  component: TimelinePage,
});

function TimelinePage() {
  const { data: history = [], isLoading } = useQuery({ queryKey: ["history", "timeline"], queryFn: () => listHistory({ limit: 500 }) });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-glow">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Project timeline</h1>
          <p className="text-sm text-muted-foreground">Chronological log of every generation event.</p>
        </div>
      </div>

      <Card className="glass rounded-2xl p-6">
        {isLoading ? (
          <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No events yet.</div>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-6">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full gradient-primary shadow-glow" />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium capitalize">{h.asset_type.replaceAll("_", " ")}</span>
                  <Badge variant="secondary" className="rounded-full text-[10px] uppercase">{h.status}</Badge>
                  {h.provider && <Badge variant="outline" className="rounded-full text-[10px]">{h.provider}</Badge>}
                  {h.project_id && projectMap.get(h.project_id) && (
                    <span className="text-muted-foreground">· {projectMap.get(h.project_id)}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
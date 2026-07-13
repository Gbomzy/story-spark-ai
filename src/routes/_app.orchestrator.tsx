import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { listInProgressProductions } from "@/lib/orchestrator.functions";
import { stageLabel } from "@/lib/orchestrator";

export const Route = createFileRoute("/_app/orchestrator")({
  head: () => ({ meta: [{ title: "Orchestrator — StorySpark AI" }] }),
  component: OrchestratorDashboard,
});

function OrchestratorDashboard() {
  const list = useServerFn(listInProgressProductions);
  const q = useQuery({
    queryKey: ["orch-productions"],
    queryFn: () => list(),
    refetchInterval: 5000,
  });
  const productions = q.data?.productions ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Orchestrator Dashboard"
        description="Every production the AI is currently coordinating."
      />
      {productions.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No active productions. Start one from the <Link to="/create-movie" className="text-primary underline">Create Movie</Link> page.
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {productions.map((p) => (
          <Card key={p.id} className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <Link to="/create-movie" className="font-semibold hover:underline">{p.name}</Link>
              <Badge variant={p.state.status === "running" ? "default" : p.state.status === "failed" ? "destructive" : "secondary"}>
                {p.state.status}
              </Badge>
            </div>
            <Progress value={p.state.progress} />
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Current: <span className="text-foreground font-medium">{p.state.currentStage ? stageLabel(p.state.currentStage) : "—"}</span></div>
              <div>Credits: <span className="text-foreground font-medium">{p.state.creditsUsed}</span></div>
              {p.state.currentScene ? <div>Scene: {p.state.currentScene}</div> : null}
              {p.state.currentClip ? <div>Clip: {p.state.currentClip}</div> : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
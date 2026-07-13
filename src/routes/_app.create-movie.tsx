import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, Play, Pause, RotateCcw, X, Wand2, Clock, Zap, HardDrive, Film } from "lucide-react";
import { PROJECT_TEMPLATES, findTemplate } from "@/lib/projectTemplates";
import { estimateProduction, formatDuration, formatStorage } from "@/lib/aiProducer";
import {
  ORCH_STAGES,
  parseOrchestratorState,
  stageLabel,
  type OrchStage,
  type OrchestratorState,
} from "@/lib/orchestrator";
import {
  getOrchestratorState,
  controlOrchestrator,
  markStageRunning,
  markStageCompleted,
  markStageFailed,
} from "@/lib/orchestrator.functions";
import { pushSelfNotification } from "@/lib/notifications.functions";
import { createProject } from "@/lib/projects";
import { formatDbError } from "@/lib/dbError";

export const Route = createFileRoute("/_app/create-movie")({
  head: () => ({
    meta: [
      { title: "Create Movie — StorySpark AI" },
      { name: "description", content: "One-click AI movie production. Type a prompt and let the orchestrator build the full film." },
    ],
  }),
  component: CreateMoviePage,
});

function CreateMoviePage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [targetLen, setTargetLen] = useState(180);

  const estimate = useMemo(
    () => estimateProduction({ prompt, targetLengthSec: targetLen }),
    [prompt, targetLen],
  );

  const notify = useServerFn(pushSelfNotification);

  const start = useMutation({
    mutationFn: async () => {
      const tpl = findTemplate(templateId);
      const project = await createProject({
        name: prompt.slice(0, 60) || tpl?.name || "New Movie",
        topic: prompt,
        style: tpl?.artStyle ?? null,
        settings: {
          templateId: tpl?.id ?? null,
          aspectRatio: tpl?.aspectRatio ?? "16:9",
          targetLengthSec: targetLen,
          music: tpl?.music ?? null,
          voice: tpl?.voice ?? null,
        },
      });
      if (!project) throw new Error("Failed to create project");
      await notify({ data: { kind: "generation_complete", title: "Production started", body: prompt.slice(0, 100), projectId: project.id } })
        .catch(() => {});
      return project.id;
    },
    onSuccess: (id) => {
      setProjectId(id);
      toast.success("Production started");
    },
    onError: (e) => toast.error(formatDbError(e)),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Create Movie"
        description="Type one prompt. The AI orchestrator handles the rest."
      />

      {!projectId && (
        <>
          <Card className="space-y-4 p-6">
            <div>
              <label className="text-sm font-medium">Movie idea</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A curious rabbit discovers a hidden garden and learns about friendship…"
                className="mt-2 min-h-24"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Target length: {formatDuration(targetLen)}</label>
              <input
                type="range" min={30} max={600} step={15}
                value={targetLen}
                onChange={(e) => setTargetLen(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Start from a template (optional)</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {PROJECT_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTemplateId(t.id); if (!prompt) setPrompt(t.prompt); }}
                    className={`rounded-xl border p-3 text-left text-sm hover:bg-muted/50 ${templateId === t.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Wand2 className="h-4 w-4" /> AI Producer estimate
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat icon={<Film className="h-4 w-4" />} label="Movie length" value={formatDuration(estimate.movieLengthSec)} />
              <Stat label="Scenes" value={String(estimate.scenes)} />
              <Stat label="Clips" value={String(estimate.clips)} />
              <Stat label="Images" value={String(estimate.imagesRequired)} />
              <Stat icon={<Zap className="h-4 w-4" />} label="Estimated credits" value={`~${estimate.creditsRequired}`} />
              <Stat icon={<Clock className="h-4 w-4" />} label="Estimated time" value={formatDuration(estimate.renderTimeSec)} />
              <Stat icon={<HardDrive className="h-4 w-4" />} label="Storage" value={formatStorage(estimate.storageMb)} />
              <Stat label="Video seconds" value={formatDuration(estimate.videoDurationSec)} />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => navigate({ to: "/projects" })}>Cancel</Button>
              <Button
                disabled={!prompt.trim() || start.isPending}
                onClick={() => start.mutate()}
                className="gradient-primary"
              >
                {start.isPending ? "Starting…" : "Start Production"}
              </Button>
            </div>
          </Card>
        </>
      )}

      {projectId && <OrchestratorPanel projectId={projectId} onExit={() => setProjectId(null)} />}
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function OrchestratorPanel({ projectId, onExit }: { projectId: string; onExit: () => void }) {
  const getState = useServerFn(getOrchestratorState);
  const control = useServerFn(controlOrchestrator);
  const running = useServerFn(markStageRunning);
  const completed = useServerFn(markStageCompleted);
  const failed = useServerFn(markStageFailed);

  const q = useQuery({
    queryKey: ["orch-state", projectId],
    queryFn: () => getState({ data: { projectId } }),
    refetchInterval: 2500,
  });
  const state: OrchestratorState = q.data?.state ?? parseOrchestratorState(null);

  // Kick off the orchestrator on first mount.
  useEffect(() => {
    control({ data: { projectId, action: "start" } }).catch(() => {});
    // Ask for browser notification permission once.
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [control, projectId]);

  // Simulate advancing the pipeline stage-by-stage. Each tick advances the
  // next pending stage. Real generator work is triggered from the specific
  // studios; the orchestrator persists progress so users can pick up where
  // they left off. This gives resume-safety by construction.
  useEffect(() => {
    if (state.status !== "running") return;
    const next = ORCH_STAGES.find((s) => state.stages[s].state === "pending" || state.stages[s].state === "failed");
    if (!next) return;
    let cancelled = false;
    (async () => {
      try {
        await running({ data: { projectId, stage: next } });
        // Simulated stage duration proportional to complexity.
        const durMs = simulatedDurationMs(next);
        await new Promise((r) => setTimeout(r, durMs));
        if (cancelled) return;
        await completed({ data: { projectId, stage: next, creditsUsed: simulatedCredits(next) } });
        if (typeof document !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
          try { new Notification(`Stage completed: ${stageLabel(next)}`); } catch {}
        }
      } catch (e) {
        if (cancelled) return;
        await failed({ data: { projectId, stage: next, error: e instanceof Error ? e.message : String(e) } }).catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [state.status, state.stages, projectId, running, completed, failed]);

  const finished = state.status === "completed";
  const failedRun = state.status === "failed";

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Production in progress</div>
          <div className="text-sm text-muted-foreground">
            {state.currentStage ? `Current stage: ${stageLabel(state.currentStage)}` : "Preparing…"}
          </div>
        </div>
        <StatusBadge status={state.status} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Overall progress</span>
          <span>{state.progress}%</span>
        </div>
        <Progress value={state.progress} />
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Credits used: <span className="font-semibold text-foreground">{state.creditsUsed}</span></span>
          {state.currentScene ? <span>Scene: {state.currentScene}</span> : null}
          {state.currentClip ? <span>Clip: {state.currentClip}</span> : null}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {ORCH_STAGES.map((s) => (
          <StageRow key={s} stage={s} entry={state.stages[s]} />
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {state.status === "running" && (
          <Button variant="outline" onClick={() => control({ data: { projectId, action: "pause" } })}>
            <Pause className="mr-1 h-4 w-4" /> Pause
          </Button>
        )}
        {state.status === "paused" && (
          <Button onClick={() => control({ data: { projectId, action: "resume" } })}>
            <Play className="mr-1 h-4 w-4" /> Resume
          </Button>
        )}
        {(state.status === "failed" || state.status === "paused") && (
          <Button variant="outline" onClick={() => control({ data: { projectId, action: "reset" } })}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
        )}
        {!finished && (
          <Button variant="destructive" onClick={() => control({ data: { projectId, action: "cancel" } })}>
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
        )}
        {(finished || failedRun) && (
          <Button onClick={onExit}>Start another</Button>
        )}
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: OrchestratorState["status"] }) {
  const map: Record<OrchestratorState["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    idle: { label: "Idle", variant: "outline" },
    running: { label: "Running", variant: "default" },
    paused: { label: "Paused", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const cfg = map[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function StageRow({ stage, entry }: { stage: OrchStage; entry: OrchestratorState["stages"][OrchStage] }) {
  const color =
    entry.state === "completed" ? "bg-emerald-500/10 text-emerald-600" :
    entry.state === "running" ? "bg-primary/10 text-primary animate-pulse" :
    entry.state === "failed" ? "bg-destructive/10 text-destructive" :
    entry.state === "skipped" ? "bg-muted text-muted-foreground" :
    "bg-muted/50 text-muted-foreground";
  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${color}`}>
      <div className="font-medium">{stageLabel(stage)}</div>
      <div className="text-xs uppercase tracking-wide">{entry.state}</div>
    </div>
  );
}

function simulatedDurationMs(stage: OrchStage): number {
  const heavy: OrchStage[] = ["images", "voice", "video", "composition"];
  return heavy.includes(stage) ? 3000 : 1200;
}

function simulatedCredits(stage: OrchStage): number {
  const map: Partial<Record<OrchStage, number>> = {
    story: 8, storyboard: 18, characters: 6, images: 24, voice: 12, video: 60, music: 16, seo: 4, thumbnail: 3, composition: 8,
  };
  return map[stage] ?? 2;
}
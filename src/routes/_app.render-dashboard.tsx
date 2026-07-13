import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listProjects } from "@/lib/projects";
import {
  CLIP_STAGES,
  type ClipStage,
  type ClipState,
  type PerformanceMode,
  type RenderCheckpoint,
  type SceneState,
  computeMovieProgress,
  emptyCheckpoint,
  loadCheckpoint,
  nextPendingClips,
  saveCheckpoint,
  stageColor,
  stageLabel,
  updateClip,
  workerCountFor,
} from "@/lib/renderEngine";
import { cacheStats } from "@/lib/renderCache";
import { Loader2, Pause, Play, RefreshCw, Zap } from "lucide-react";

export const Route = createFileRoute("/_app/render-dashboard")({
  head: () => ({ meta: [{ title: "Render Dashboard — StorySpark AI" }] }),
  component: RenderDashboard,
});

type Project = { id: string; name: string; scenes?: unknown };

function seedFromProject(p: Project, mode: PerformanceMode): RenderCheckpoint {
  const cp = emptyCheckpoint(p.id, mode);
  const raw = (p.scenes as Array<{ title?: string; clips?: unknown[] } | string> | undefined) ?? [];
  const scenes: SceneState[] = raw.slice(0, 12).map((s, i) => {
    const name = typeof s === "string" ? s : s.title ?? `Scene ${i + 1}`;
    const clipCount = typeof s === "object" && Array.isArray(s.clips) ? Math.max(1, s.clips.length) : 2;
    const clips: ClipState[] = Array.from({ length: clipCount }, (_, k) => ({
      sceneIndex: i,
      clipIndex: k,
      stage: "queued" as ClipStage,
      progress: 0,
      elapsedMs: 0,
      etaMs: 0,
      retries: 0,
      creditsUsed: 0,
      updatedAt: new Date().toISOString(),
    }));
    return { index: i, name, clips, status: "queued", progress: 0 };
  });
  cp.scenes = scenes.length
    ? scenes
    : [{ index: 0, name: "Scene 1", clips: [{ sceneIndex: 0, clipIndex: 0, stage: "queued", progress: 0, elapsedMs: 0, etaMs: 0, retries: 0, creditsUsed: 0, updatedAt: new Date().toISOString() }], status: "queued", progress: 0 }];
  return cp;
}

function useSimulator(cp: RenderCheckpoint | null, running: boolean, setCp: (n: RenderCheckpoint) => void) {
  useEffect(() => {
    if (!cp || !running) return;
    const timer = window.setInterval(() => {
      let next = cp;
      const workers = workerCountFor(cp.mode);
      const active = nextPendingClips(next, workers);
      for (const [wid, clip] of active.entries()) {
        const stageOrder: ClipStage[] = ["queued", "preparing", "submitting", "rendering", "downloading", "processing", "composing", "completed"];
        const idx = stageOrder.indexOf(clip.stage);
        const advance = idx < 0 ? 0 : Math.min(idx + 1, stageOrder.length - 1);
        const bump = Math.min(100, clip.progress + 15 + Math.random() * 15);
        const newStage: ClipStage = bump >= 100 ? "completed" : stageOrder[advance] ?? "rendering";
        next = updateClip(next, clip.sceneIndex, clip.clipIndex, {
          stage: newStage,
          progress: bump,
          workerId: wid + 1,
          provider: clip.provider ?? "wan",
          elapsedMs: clip.elapsedMs + 1000,
          etaMs: Math.max(0, ((100 - bump) / Math.max(1, bump)) * (clip.elapsedMs + 1000)),
          operation: newStage,
          creditsUsed: newStage === "completed" ? clip.creditsUsed + 1 : clip.creditsUsed,
        });
      }
      setCp(next);
      saveCheckpoint(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cp, running, setCp]);
}

function RenderDashboard() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<PerformanceMode>("balanced");
  const [cp, setCp] = useState<RenderCheckpoint | null>(null);
  const [running, setRunning] = useState(false);

  const project = useMemo(
    () => (projects as Project[]).find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  useEffect(() => {
    if (!project) return;
    const stored = loadCheckpoint(project.id);
    if (stored) setCp({ ...stored, mode });
    else setCp(seedFromProject(project, mode));
  }, [project, mode]);

  useSimulator(cp, running, (n) => setCp(n));

  const movieProgress = cp ? computeMovieProgress(cp) : 0;
  const totalClips = cp?.scenes.reduce((s, sc) => s + sc.clips.length, 0) ?? 0;
  const completedClips = cp?.scenes.reduce((s, sc) => s + sc.clips.filter((c) => c.stage === "completed").length, 0) ?? 0;
  const failedClips = cp?.scenes.reduce((s, sc) => s + sc.clips.filter((c) => c.stage === "failed").length, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Render Dashboard"
        description="Distributed render engine — live scene state, worker pool, cache and timeline."
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-56 flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Project</label>
          <Select value={projectId ?? ""} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder={isLoading ? "Loading…" : "Choose a project"} /></SelectTrigger>
            <SelectContent>
              {(projects as Project[]).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Performance</label>
          <Select value={mode} onValueChange={(v) => setMode(v as PerformanceMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="eco">Eco (1 worker)</SelectItem>
              <SelectItem value="balanced">Balanced (3 workers)</SelectItem>
              <SelectItem value="turbo">Turbo (6 workers)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setRunning((r) => !r)} disabled={!cp} className="gap-2">
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            if (project) {
              const fresh = seedFromProject(project, mode);
              setCp(fresh);
              saveCheckpoint(fresh);
            }
          }}
          disabled={!project}
        >
          <RefreshCw className="h-4 w-4" /> Reset
        </Button>
      </Card>

      {!cp ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {isLoading ? (
            <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading projects…</>
          ) : (
            "Pick a project to see its render timeline."
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Movie progress" value={`${movieProgress}%`} />
            <Stat label="Clips" value={`${completedClips}/${totalClips}`} />
            <Stat label="Failed" value={failedClips.toString()} />
            <Stat label="Cache entries" value={cacheStats().entries.toString()} />
          </div>
          <Progress value={movieProgress} />

          <div className="grid gap-3">
            {cp.scenes.map((s) => (
              <SceneCard
                key={s.index}
                scene={s}
                onRetry={() =>
                  setCp((prev) => {
                    if (!prev) return prev;
                    let n = prev;
                    for (const c of s.clips) if (c.stage === "failed") n = updateClip(n, s.index, c.clipIndex, { stage: "retrying", progress: 0, retries: c.retries + 1 });
                    return n;
                  })
                }
              />
            ))}
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Render timeline</h3>
            <div className="space-y-2">
              {cp.scenes.map((s) => (
                <div key={s.index} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 truncate text-xs text-muted-foreground">{s.name}</div>
                  <div className="flex h-4 flex-1 overflow-hidden rounded bg-muted">
                    {s.clips.map((c) => (
                      <div
                        key={c.clipIndex}
                        title={`Clip ${c.clipIndex + 1} · ${stageLabel(c.stage)} · ${Math.round(c.progress)}%`}
                        className={`${stageColor(c.stage)} border-r border-background/40`}
                        style={{ width: `${100 / s.clips.length}%`, opacity: c.stage === "queued" ? 0.35 : 1 }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {CLIP_STAGES.slice(0, 8).map((st) => (
                <div key={st} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${stageColor(st)}`} />
                  {stageLabel(st)}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </Card>
  );
}

function SceneCard({ scene, onRetry }: { scene: SceneState; onRetry: () => void }) {
  const hasFailed = scene.clips.some((c) => c.stage === "failed");
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Scene {scene.index + 1}</Badge>
            <span className="font-semibold">{scene.name}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {scene.clips.length} clips · {scene.progress}% · {stageLabel(scene.status)}
          </div>
        </div>
        <div className="flex gap-2">
          {hasFailed && (
            <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Retry failed
            </Button>
          )}
        </div>
      </div>
      <Progress value={scene.progress} className="mb-3" />
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {scene.clips.map((c) => (
          <div key={c.clipIndex} className="rounded-md border p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">Clip {c.clipIndex + 1}</span>
              <Badge className={`${stageColor(c.stage)} text-white`}>{stageLabel(c.stage)}</Badge>
            </div>
            <div className="mt-1 text-muted-foreground">
              {Math.round(c.progress)}% · Worker {c.workerId ?? "–"} · {c.provider ?? "auto"}
              {c.retries > 0 ? ` · ${c.retries} retries` : ""}
            </div>
            <Progress value={c.progress} className="mt-1 h-1" />
          </div>
        ))}
      </div>
    </Card>
  );
}

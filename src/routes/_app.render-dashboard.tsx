import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { getRenderState, controlRender } from "@/lib/renderControls.functions";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Pause, Play, RefreshCw, X, RotateCw, AlertTriangle } from "lucide-react";
import type { SceneClip } from "@/lib/pipelineEngine.functions";

export const Route = createFileRoute("/_app/render-dashboard")({
  head: () => ({ meta: [{ title: "Render Dashboard — StorySpark AI" }] }),
  component: RenderDashboard,
});

type Project = { id: string; name: string };

const CLIP_COLOR: Record<string, string> = {
  pending: "bg-muted",
  queued: "bg-muted",
  starting: "bg-blue-400",
  uploading: "bg-blue-500",
  rendering: "bg-blue-600 animate-pulse",
  processing: "bg-indigo-500",
  saving: "bg-indigo-600",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-zinc-500",
  paused: "bg-amber-500",
  retrying: "bg-orange-500 animate-pulse",
  stalled: "bg-red-600 animate-pulse",
};

function clipColor(status?: string): string {
  return CLIP_COLOR[status ?? "pending"] ?? "bg-muted";
}

function fmtDuration(ms: number): string {
  if (!ms || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function RenderDashboard() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [projectId, setProjectId] = useState<string | null>(null);
  const qc = useQueryClient();
  const getState = useServerFn(getRenderState);
  const control = useServerFn(controlRender);

  // Poll real render state every 2s while selected; realtime supplements it.
  const stateQuery = useQuery({
    queryKey: ["render-state", projectId],
    queryFn: () => getState({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    refetchInterval: 2000,
  });

  // Realtime subscription — invalidate on any change to this project row.
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`project:${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["render-state", projectId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, qc]);

  const s = stateQuery.data;
  const clips: SceneClip[] = s?.clips ?? [];
  const scenes = useMemo(() => groupByScene(clips), [clips]);

  // Overall movie stats
  const startedMs = s?.startedAt ? new Date(s.startedAt).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const elapsedMs = startedMs ? Math.max(0, now - startedMs) : 0;
  const completed = s?.completed ?? 0;
  const avgClipMs = completed > 0 && elapsedMs > 0 ? elapsedMs / completed : 0;
  const etaMs = (s?.remaining ?? 0) * avgClipMs;
  const active = clips.find((c) => ["starting", "rendering", "retrying", "processing", "uploading", "saving"].includes(c.status ?? "")) ?? null;
  const lastCompleted = [...clips].reverse().find((c) => c.status === "completed") ?? null;
  const lastFailed = [...clips].reverse().find((c) => c.status === "failed" || c.status === "stalled") ?? null;

  const heartbeatMs = s?.heartbeat ? Date.now() - new Date(s.heartbeat).getTime() : Infinity;
  const workerHealthy = heartbeatMs < 60_000;
  const stalled = s?.status === "stalled" || heartbeatMs > 120_000;

  const runControl = async (action: "pause" | "resume" | "cancel" | "retry_failed" | "clear_stalled") => {
    if (!projectId) return;
    await control({ data: { projectId, action } });
    await stateQuery.refetch();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Render Dashboard"
        description="Live render engine — real per-clip state, heartbeat monitoring, and recovery controls."
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
        <Button onClick={() => runControl("pause")} disabled={!s || s.status !== "generating"} variant="outline" className="gap-2">
          <Pause className="h-4 w-4" /> Pause
        </Button>
        <Button onClick={() => runControl("resume")} disabled={!s || (s.status !== "paused" && s.status !== "stalled" && s.status !== "failed")} className="gap-2">
          <Play className="h-4 w-4" /> Resume
        </Button>
        <Button onClick={() => runControl("retry_failed")} disabled={!s || (s.failed === 0 && s.status !== "stalled")} variant="outline" className="gap-2">
          <RotateCw className="h-4 w-4" /> Retry Failed
        </Button>
        <Button onClick={() => runControl("cancel")} disabled={!s || ["completed", "cancelled"].includes(s.status ?? "")} variant="destructive" className="gap-2">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </Card>

      {!s ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {stateQuery.isFetching ? (
            <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading render state…</>
          ) : (
            "Pick a project to see its live render state."
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Status" value={String(s.status ?? "idle")} tone={stalled ? "warn" : s.status === "completed" ? "ok" : undefined} />
            <Stat label="Movie progress" value={`${s.progress ?? 0}%`} />
            <Stat label="Clips" value={`${s.completed}/${s.total}`} />
            <Stat label="Failed" value={String(s.failed)} tone={s.failed > 0 ? "warn" : undefined} />
          </div>
          <Progress value={s.progress ?? 0} />

          {stalled && (
            <Card className="border-red-500/50 bg-red-500/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-red-500">
                <AlertTriangle className="h-4 w-4" /> Render stalled
              </div>
              <p className="mt-1 text-muted-foreground">
                No heartbeat for {fmtDuration(heartbeatMs)}. {s.error ?? ""} Click <b>Retry Failed</b> or <b>Resume</b> to continue from the last unfinished clip.
              </p>
            </Card>
          )}

          <div className="grid gap-3">
            {scenes.map((sc) => (
              <SceneCard key={sc.sceneNumber} scene={sc} />
            ))}
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Overall movie progress</h3>
            <div className="grid gap-3 text-xs md:grid-cols-3">
              <Info label="Current scene" value={active ? `Scene ${active.sceneNumber}` : "—"} />
              <Info label="Current clip" value={active ? `Clip ${active.clipNumber} · ${active.status}` : "—"} />
              <Info label="Completed clips" value={`${s.completed}/${s.total}`} />
              <Info label="Remaining clips" value={String(s.remaining)} />
              <Info label="Elapsed" value={fmtDuration(elapsedMs)} />
              <Info label="Avg clip time" value={fmtDuration(avgClipMs)} />
              <Info label="ETA" value={fmtDuration(etaMs)} />
              <Info label="Provider" value={s.provider ?? "—"} />
              <Info label="Last heartbeat" value={s.heartbeat ? `${fmtDuration(heartbeatMs)} ago` : "—"} />
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Render diagnostics</h3>
            <div className="grid gap-3 text-xs md:grid-cols-3">
              <Info label="Queue health" value={s.total > 0 ? "healthy" : "empty"} />
              <Info label="Worker health" value={workerHealthy ? "alive" : stalled ? "stalled" : "idle"} tone={stalled ? "warn" : undefined} />
              <Info label="Heartbeat" value={s.heartbeat ? `${fmtDuration(heartbeatMs)} ago` : "—"} />
              <Info label="Retry count (max)" value={String(Math.max(0, ...clips.map((c) => c.retryCount ?? 0)))} />
              <Info label="Current provider" value={s.provider ?? "—"} />
              <Info label="Control signal" value={s.control ?? "none"} />
              <Info label="Last successful clip" value={lastCompleted ? `S${lastCompleted.sceneNumber}·C${lastCompleted.clipNumber}` : "—"} />
              <Info label="Last failed clip" value={lastFailed ? `S${lastFailed.sceneNumber}·C${lastFailed.clipNumber}` : "—"} />
              <Info label="DB write" value={stateQuery.isSuccess ? "ok" : "pending"} />
            </div>
            {s.error && (
              <div className="mt-3 rounded border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-500">
                {s.error}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function groupByScene(clips: SceneClip[]): Array<{ sceneNumber: number; clips: SceneClip[]; progress: number }> {
  const map = new Map<number, SceneClip[]>();
  for (const c of clips) {
    const k = c.sceneNumber;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sceneNumber, list]) => {
      const done = list.filter((c) => c.status === "completed").length;
      const progress = list.length > 0 ? Math.round((done / list.length) * 100) : 0;
      return { sceneNumber, clips: list.sort((a, b) => a.clipNumber - b.clipNumber), progress };
    });
}

function SceneCard({ scene }: { scene: { sceneNumber: number; clips: SceneClip[]; progress: number } }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">Scene {scene.sceneNumber}</div>
        <Badge variant="outline">{scene.progress}%</Badge>
      </div>
      <div className="mb-3 flex h-3 overflow-hidden rounded bg-muted">
        {scene.clips.map((c) => (
          <div
            key={c.clipNumber}
            title={`Clip ${c.clipNumber} · ${c.status ?? "pending"} · retries ${c.retryCount ?? 0}`}
            className={`${clipColor(c.status)} border-r border-background/40`}
            style={{ width: `${100 / scene.clips.length}%` }}
          />
        ))}
      </div>
      <div className="grid gap-1 text-xs">
        {scene.clips.map((c) => (
          <div key={c.clipNumber} className="flex items-center justify-between">
            <span className="text-muted-foreground">Clip {c.clipNumber}</span>
            <span className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-sm ${clipColor(c.status)}`} />
              <span className="w-24 text-right">{c.status ?? "pending"}</span>
              <span className="w-16 text-right text-muted-foreground">{(c.retryCount ?? 0) > 0 ? `↻${c.retryCount}` : ""}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "warn" ? "text-red-500" : tone === "ok" ? "text-emerald-500" : "";
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </Card>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  const color = tone === "warn" ? "text-red-500" : "text-foreground";
  return (
    <div className="flex items-center justify-between rounded border border-border/50 px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

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

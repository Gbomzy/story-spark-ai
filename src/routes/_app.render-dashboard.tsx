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

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
import {
  Loader2, Pause, Play, X, RotateCw, AlertTriangle,
  ChevronDown, ChevronRight, CheckCircle2, Circle, XCircle, Clock,
  Film, Users, Layout, Image as ImageIcon, Mic, Video, Wand2, Sparkles,
  Terminal, Download, Copy, Trash2, Eye, Wrench,
} from "lucide-react";
import type { SceneClip } from "@/lib/pipelineEngine.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/render-dashboard")({
  head: () => ({ meta: [
    { title: "Live Render — StorySpark AI" },
    { name: "description", content: "Production timeline, per-scene progress, live logs, ETA, and history for every render." },
  ] }),
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
  if (!ms || !Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

// "Not enough data" sentinel for any metric we can't yet compute honestly.
const NED = "Not enough data";

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return "—"; }
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return "—"; }
}

// ---------- Pipeline stages ----------
type StageKey = "story" | "characters" | "storyboard" | "images" | "voice" | "video" | "composition" | "ready";
type StageState = "waiting" | "running" | "completed" | "failed" | "retrying";
const STAGE_META: Array<{ key: StageKey; label: string; icon: typeof Film }> = [
  { key: "story",       label: "Story",       icon: Film },
  { key: "characters",  label: "Characters",  icon: Users },
  { key: "storyboard",  label: "Storyboard",  icon: Layout },
  { key: "images",      label: "Images",      icon: ImageIcon },
  { key: "voice",       label: "Voice",       icon: Mic },
  { key: "video",       label: "Video",       icon: Video },
  { key: "composition", label: "Composition", icon: Wand2 },
  { key: "ready",       label: "Ready",       icon: Sparkles },
];

type LogEntry = { at: number; icon: "ok" | "warn" | "info" | "fail"; message: string };

function RenderDashboard() {
  const { data: projects = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [projectId, setProjectId] = useState<string | null>(null);
  const qc = useQueryClient();
  const getState = useServerFn(getRenderState);
  const control = useServerFn(controlRender);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsOpen, setLogsOpen] = useState(true);
  const [previewClip, setPreviewClip] = useState<SceneClip | null>(null);
  const lastKeyRef = useRef<Map<string, string>>(new Map());
  const pushLog = (entry: LogEntry) => setLogs((prev) => [entry, ...prev].slice(0, 200));

  // Poll real render state every 2s while selected; realtime supplements it.
  const stateQuery = useQuery({
    queryKey: ["render-state", projectId],
    queryFn: () => getState({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    refetchInterval: 2000,
  });

  // Reset logs when switching projects
  useEffect(() => { setLogs([]); lastKeyRef.current.clear(); }, [projectId]);

  // Realtime subscription — invalidate on any change to this project row
  // and stream live log entries from render_clip_jobs.
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`project:${projectId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${projectId}` },
        () => qc.invalidateQueries({ queryKey: ["render-state", projectId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "render_clip_jobs", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            id: string; scene_number: number; clip_number: number; status: string; provider?: string | null; attempts?: number | null; error?: string | null;
          } | null;
          if (!row) return;
          const key = `${row.id}:${row.status}:${row.attempts ?? 0}`;
          if (lastKeyRef.current.get(row.id) === key) return;
          lastKeyRef.current.set(row.id, key);
          const tag = `Scene ${row.scene_number}·Clip ${row.clip_number}`;
          if (row.status === "starting") pushLog({ at: Date.now(), icon: "info", message: `${tag} started` });
          else if (row.status === "rendering") pushLog({ at: Date.now(), icon: "info", message: `${tag} ${row.provider ?? "Wan"} accepted request` });
          else if (row.status === "uploading" || row.status === "saving") pushLog({ at: Date.now(), icon: "info", message: `${tag} uploading` });
          else if (row.status === "completed") pushLog({ at: Date.now(), icon: "ok", message: `${tag} completed (${row.provider ?? "wan"})` });
          else if (row.status === "retrying") pushLog({ at: Date.now(), icon: "warn", message: `${tag} retry ${row.attempts ?? "?"}` });
          else if (row.status === "failed") pushLog({ at: Date.now(), icon: "fail", message: `${tag} failed — ${row.error ?? "unknown"}` });
          else if (row.status === "stalled") pushLog({ at: Date.now(), icon: "warn", message: `${tag} stalled` });
          qc.invalidateQueries({ queryKey: ["render-state", projectId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, qc]);

  const s = stateQuery.data;
  const clips: SceneClip[] = s?.clips ?? [];
  const scenes = useMemo(() => groupByScene(clips), [clips]);

  // Overall movie stats + ETA (advanced)
  const startedMs = s?.startedAt ? new Date(s.startedAt).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const elapsedMs = startedMs ? Math.max(0, now - startedMs) : 0;
  const completed = s?.completed ?? 0;
  const activeWorkers = clips.filter((c) => ["starting","rendering","processing","uploading","saving","retrying"].includes(c.status ?? "")).length;
  const providerAvgMs = 45_000; // baseline provider average per clip
  const historyAvg = completed > 0 && elapsedMs > 0 ? elapsedMs / completed : 0;
  const avgClipMs = historyAvg > 0
    ? historyAvg * 0.6 + providerAvgMs * 0.4
    : providerAvgMs;
  const parallelism = Math.max(1, activeWorkers || 1);
  const etaMs = Math.round(((s?.remaining ?? 0) * avgClipMs) / parallelism);
  const active = clips.find((c) => ["starting", "rendering", "retrying", "processing", "uploading", "saving"].includes(c.status ?? "")) ?? null;
  const lastCompleted = [...clips].reverse().find((c) => c.status === "completed") ?? null;
  const lastFailed = [...clips].reverse().find((c) => c.status === "failed" || c.status === "stalled") ?? null;

  const heartbeatMs = s?.heartbeat ? Date.now() - new Date(s.heartbeat).getTime() : Infinity;
  const workerHealthy = heartbeatMs < 60_000;
  const stalled = s?.status === "stalled" || heartbeatMs > 120_000;

  // Pipeline stage states — derived, additive (never mutates data).
  const stageStates = useMemo<Record<StageKey, StageState>>(() => {
    const st: Record<StageKey, StageState> = {
      story: "completed", characters: "completed", storyboard: "completed",
      images: "completed", voice: "completed",
      video: "waiting", composition: "waiting", ready: "waiting",
    };
    if (!s) return st;
    const total = s.total ?? 0;
    const done = s.completed ?? 0;
    const failed = s.failed ?? 0;
    if (total === 0) { st.video = "waiting"; return st; }
    if (done === total && failed === 0) {
      st.video = "completed";
      st.composition = s.status === "completed" ? "completed" : "running";
      st.ready = s.status === "completed" ? "completed" : "waiting";
    } else if (failed > 0 && done + failed === total) {
      st.video = "failed";
    } else if (clips.some((c) => c.status === "retrying")) {
      st.video = "retrying";
    } else {
      st.video = "running";
    }
    return st;
  }, [s, clips]);

  // Render history — completed jobs for this user, most recent first.
  const historyQuery = useQuery({
    queryKey: ["render-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("render_jobs")
        .select("id, project_id, status, started_at, finished_at, mode, created_at, movie_url")
        .in("status", ["completed", "failed"])
        .order("finished_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Production dashboard aggregates — projects, cheap client-side sums.
  const prodStats = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const jobs = (historyQuery.data ?? []) as Array<{ status: string; finished_at?: string | null; started_at?: string | null }>;
    const todayJobs = jobs.filter((j) => j.finished_at && new Date(j.finished_at) >= today);
    const completedToday = todayJobs.filter((j) => j.status === "completed").length;
    const durations = todayJobs
      .filter((j) => j.started_at && j.finished_at)
      .map((j) => new Date(j.finished_at!).getTime() - new Date(j.started_at!).getTime())
      .filter((n) => n > 0);
    const avgMs = durations.length ? durations.reduce((a,b) => a+b, 0) / durations.length : 0;
    const success = jobs.length ? Math.round((jobs.filter((j) => j.status === "completed").length / jobs.length) * 100) : 0;
    return { completedToday, avgMs, success };
  }, [historyQuery.data]);

  const runControl = async (action: "pause" | "resume" | "cancel" | "retry_failed" | "clear_stalled") => {
    if (!projectId) return;
    await control({ data: { projectId, action } });
    await stateQuery.refetch();
    toast.success(`Render ${action.replace("_"," ")} sent`);
  };

  // In-page notifications: fire when key milestones flip. Idempotent per key.
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!s || !projectId) return;
    const total = s.total ?? 0;
    const done = s.completed ?? 0;
    const mk = (k: string, fn: () => void) => {
      const key = `${projectId}:${k}`;
      if (notifiedRef.current.has(key)) return;
      notifiedRef.current.add(key);
      fn();
    };
    if (done >= 1) mk("first", () => toast.success("First scene finished"));
    if (total > 0 && done * 2 >= total) mk("half", () => toast.success("Half the movie is complete"));
    if (s.status === "completed") mk("ready", () => toast.success("Movie ready", { description: "Composition finalized." }));
    if (s.failed > 0 && s.status !== "generating") mk("partial", () => toast.warning("Movie partially completed", { description: "Use Repair to retry failed clips." }));
  }, [s, projectId]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <PageHeader
        title="Live Render"
        description="Production timeline, per-scene progress, live logs, ETA, and history."
      />

      <ProductionStats
        rendering={clips.some((c) => ["starting","rendering","processing"].includes(c.status ?? "")) ? 1 : 0}
        queued={clips.filter((c) => c.status === "queued" || c.status === "pending" || !c.status).length}
        completedToday={prodStats.completedToday}
        avgMs={prodStats.avgMs}
        successPct={prodStats.success}
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
        <Button onClick={() => runControl("pause")} disabled={!s || !["generating","rendering","processing","queued"].includes(String(s.status))} variant="outline" className="gap-2">
          <Pause className="h-4 w-4" /> Pause
        </Button>
        <Button onClick={() => runControl("resume")} disabled={!s || !["paused","stalled","failed","cancelled"].includes(String(s.status))} className="gap-2">
          <Play className="h-4 w-4" /> Resume
        </Button>
        <Button onClick={() => runControl("retry_failed")} disabled={!s || (s.failed === 0 && s.status !== "stalled" && s.status !== "failed")} variant="outline" className="gap-2">
          <RotateCw className="h-4 w-4" /> Retry Failed
        </Button>
        <Button onClick={() => runControl("cancel")} disabled={!s || ["completed", "cancelled"].includes(s.status ?? "")} variant="destructive" className="gap-2">
          <X className="h-4 w-4" /> Cancel
        </Button>
      </Card>

      {!s ? (
        <>
          {projectId ? <LoadingSkeleton /> : (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Pick a project to see its live render state.
            </Card>
          )}
          <RenderHistorySection items={historyQuery.data ?? []} projects={projects as Project[]} onOpen={(pid) => setProjectId(pid)} />
        </>
      ) : (
        <>
          <PipelineTimeline stageStates={stageStates} elapsedMs={elapsedMs} startedMs={startedMs} />

          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Status" value={String(s.status ?? "idle")} tone={stalled ? "warn" : s.status === "completed" ? "ok" : undefined} />
            <Stat label="Movie progress" value={`${s.progress ?? 0}%`} />
            <Stat label="Clips" value={`${s.completed}/${s.total}`} />
            <Stat label="ETA" value={etaMs > 0 ? fmtDuration(etaMs) : "—"} />
          </div>
          <Progress value={s.progress ?? 0} className="transition-all duration-500" />

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
              <SceneCard
                key={sc.sceneNumber}
                scene={sc}
                avgClipMs={avgClipMs}
                onPreview={(clip) => setPreviewClip(clip)}
                onRetry={() => runControl("retry_failed")}
              />
            ))}
          </div>

          <RenderLogsPanel logs={logs} open={logsOpen} onToggle={() => setLogsOpen((v) => !v)} />

          <PerformanceView
            workers={parallelism}
            queueSize={s.remaining ?? 0}
            avgClipMs={avgClipMs}
            providerLatencyMs={historyAvg || providerAvgMs}
            mode={s.status ?? "idle"}
            heartbeatMs={heartbeatMs}
          />

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

          <RenderHistorySection items={historyQuery.data ?? []} projects={projects as Project[]} onOpen={(pid) => setProjectId(pid)} />
        </>
      )}

      {previewClip && (
        <ScenePreviewModal clip={previewClip} onClose={() => setPreviewClip(null)} />
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

function SceneCard({
  scene, avgClipMs, onPreview, onRetry,
}: {
  scene: { sceneNumber: number; clips: SceneClip[]; progress: number };
  avgClipMs: number;
  onPreview: (clip: SceneClip) => void;
  onRetry: () => void;
}) {
  const activeClip = scene.clips.find((c) => ["starting","rendering","processing","uploading","saving","retrying"].includes(c.status ?? ""));
  const failed = scene.clips.filter((c) => c.status === "failed");
  const firstCompleted = scene.clips.find((c) => c.status === "completed");
  const remaining = scene.clips.filter((c) => c.status !== "completed" && c.status !== "cancelled").length;
  const etaMs = Math.round(remaining * (avgClipMs || 45_000));
  const hasFailure = failed.length > 0;
  return (
    <Card className={`p-4 transition-all ${hasFailure ? "border-red-500/50 bg-red-500/5" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {firstCompleted?.cover && (
            <img src={firstCompleted.cover} alt="" className="h-10 w-16 rounded object-cover" />
          )}
          <div>
            <div className="text-sm font-medium">Scene {scene.sceneNumber}</div>
            <div className="text-xs text-muted-foreground">
              {activeClip ? `Clip ${activeClip.clipNumber} · ${activeClip.status}` : `${scene.clips.length} clip${scene.clips.length > 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={hasFailure ? "destructive" : "outline"}>{scene.progress}%</Badge>
          {firstCompleted && (
            <Button size="sm" variant="ghost" onClick={() => onPreview(firstCompleted)} className="gap-1">
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
          )}
          {hasFailure && (
            <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
              <Wrench className="h-3.5 w-3.5" /> Repair
            </Button>
          )}
        </div>
      </div>
      <div className="mb-3 flex h-3 overflow-hidden rounded bg-muted">
        {scene.clips.map((c) => (
          <div
            key={c.clipNumber}
            title={`Clip ${c.clipNumber} · ${c.status ?? "pending"} · retries ${c.retryCount ?? 0}${c.error ? ` · ${c.error}` : ""}`}
            className={`${clipColor(c.status)} border-r border-background/40`}
            style={{ width: `${100 / scene.clips.length}%` }}
          />
        ))}
      </div>
      <div className="grid gap-1 text-xs">
        {scene.clips.map((c) => (
          <div key={c.clipNumber} className={`grid grid-cols-6 items-center gap-2 rounded px-2 py-1 ${c.status === "failed" ? "bg-red-500/10" : ""}`}>
            <span className="text-muted-foreground">Clip {c.clipNumber}</span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-sm ${clipColor(c.status)}`} />
              <span>{c.status ?? "pending"}</span>
            </span>
            <span className="text-muted-foreground">{c.provider ?? "—"}</span>
            <span className="text-muted-foreground">{c.durationSeconds ? `${Math.round(c.durationSeconds)}s` : "—"}</span>
            <span className="text-muted-foreground text-right">{fmtTime(c.completedAt as string | undefined)}</span>
            <span className="text-right text-muted-foreground">{(c.retryCount ?? 0) > 0 ? `↻${c.retryCount}` : ""}</span>
          </div>
        ))}
      </div>
      {(remaining > 0 || activeClip) && (
        <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
          <span>Est. remaining · {fmtDuration(etaMs)}</span>
          <span>{scene.clips.filter((c) => c.status === "completed").length}/{scene.clips.length} done</span>
        </div>
      )}
      {hasFailure && failed[0]?.error && (
        <div className="mt-2 rounded border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-500">
          <div className="font-medium">Failure reason</div>
          <div className="mt-0.5 text-red-400/90">{failed[0].error}</div>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "warn" ? "text-red-500" : tone === "ok" ? "text-emerald-500" : "";
  return (
    <Card className="p-4 transition-all hover:shadow-md">
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

// ---------- Pipeline timeline ----------
function PipelineTimeline({ stageStates, elapsedMs, startedMs }: { stageStates: Record<StageKey, StageState>; elapsedMs: number; startedMs: number }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Production timeline</h3>
        <span className="text-xs text-muted-foreground">
          {startedMs ? `Started ${fmtTime(new Date(startedMs).toISOString())} · Elapsed ${fmtDuration(elapsedMs)}` : "Waiting to start"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
        {STAGE_META.map(({ key, label, icon: Icon }) => {
          const state = stageStates[key];
          const tone =
            state === "completed" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" :
            state === "running"   ? "border-blue-500/40 bg-blue-500/10 text-blue-500 animate-pulse" :
            state === "failed"    ? "border-red-500/40 bg-red-500/10 text-red-500" :
            state === "retrying"  ? "border-orange-500/40 bg-orange-500/10 text-orange-500 animate-pulse" :
                                    "border-border bg-muted/30 text-muted-foreground";
          const StatusIcon =
            state === "completed" ? CheckCircle2 :
            state === "failed" ? XCircle :
            state === "running" || state === "retrying" ? Loader2 :
            Circle;
          return (
            <div key={key} className={`rounded-lg border p-3 transition-all ${tone}`}>
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4" />
                <StatusIcon className={`h-3.5 w-3.5 ${state === "running" || state === "retrying" ? "animate-spin" : ""}`} />
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{label}</div>
              <div className="text-[10px] uppercase tracking-wide opacity-80">{state}</div>
              {state === "running" && (
                <div className="mt-1 text-[10px] text-muted-foreground">{fmtDuration(elapsedMs)}</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- Live logs ----------
function RenderLogsPanel({ logs, open, onToggle }: { logs: LogEntry[]; open: boolean; onToggle: () => void }) {
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Terminal className="h-4 w-4" /> Render Logs
          <Badge variant="outline" className="ml-1">{logs.length}</Badge>
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="max-h-72 overflow-auto border-t border-border/50 px-4 py-3 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">Waiting for render events…</div>
          ) : (
            <ul className="space-y-1">
              {logs.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{fmtTime(new Date(l.at).toISOString())}</span>
                  <span className={
                    l.icon === "ok" ? "text-emerald-500" :
                    l.icon === "warn" ? "text-amber-500" :
                    l.icon === "fail" ? "text-red-500" :
                    "text-blue-500"
                  }>{l.icon === "ok" ? "✓" : l.icon === "warn" ? "⚠" : l.icon === "fail" ? "✕" : "→"}</span>
                  <span>{l.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- Production stats ----------
function ProductionStats({ rendering, queued, completedToday, avgMs, successPct }: {
  rendering: number; queued: number; completedToday: number; avgMs: number; successPct: number;
}) {
  const hasHistory = completedToday > 0 || avgMs > 0;
  return (
    <div className="grid gap-3 md:grid-cols-5">
      <Stat label="Movies rendering" value={String(rendering)} />
      <Stat label="Queued" value={String(queued)} />
      <Stat label="Completed today" value={String(completedToday)} />
      <Stat label="Avg render time" value={avgMs > 0 ? fmtDuration(avgMs) : NED} />
      <Stat
        label="Success rate"
        value={hasHistory ? `${successPct}%` : NED}
        tone={hasHistory ? (successPct >= 90 ? "ok" : successPct < 70 ? "warn" : undefined) : undefined}
      />
    </div>
  );
}

// ---------- Performance view ----------
function PerformanceView({ workers, queueSize, avgClipMs, providerLatencyMs, mode, heartbeatMs }: {
  workers: number; queueSize: number; avgClipMs: number; providerLatencyMs: number; mode: string; heartbeatMs: number;
}) {
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Performance</h3>
      <div className="grid gap-3 text-xs md:grid-cols-3">
        <Info label="Active workers" value={String(workers)} />
        <Info label="Queue size" value={String(queueSize)} />
        <Info label="Avg clip time" value={fmtDuration(avgClipMs)} />
        <Info label="Provider latency" value={fmtDuration(providerLatencyMs)} />
        <Info label="Current mode" value={mode} />
        <Info label="Heartbeat age" value={heartbeatMs === Infinity ? "—" : fmtDuration(heartbeatMs)} tone={heartbeatMs > 120_000 ? "warn" : undefined} />
      </div>
    </Card>
  );
}

// ---------- History ----------
function RenderHistorySection({ items, projects, onOpen }: {
  items: Array<{ id: string; project_id: string; status: string; started_at?: string | null; finished_at?: string | null; mode?: string | null; created_at: string; movie_url?: string | null }>;
  projects: Project[];
  onOpen: (projectId: string) => void;
}) {
  const nameOf = (pid: string) => projects.find((p) => p.id === pid)?.name ?? pid.slice(0, 8);
  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">Render history</h3>
      {items.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No completed renders yet.</div>
      ) : (
        <div className="overflow-hidden rounded border border-border/50">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Project</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Runtime</th>
                <th className="px-3 py-2 text-left">Mode</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const runtime = r.started_at && r.finished_at
                  ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
                  : 0;
                return (
                  <tr key={r.id} className="border-t border-border/50 transition-colors hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{nameOf(r.project_id)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.finished_at ?? r.created_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDuration(runtime)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.mode ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "completed" ? "outline" : "destructive"}>{r.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onOpen(r.project_id)} title="View" className="h-7 w-7 p-0">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {r.movie_url && (
                          <a href={r.movie_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost" title="Download" className="h-7 w-7 p-0">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => toast.info("Duplicate coming soon")} title="Duplicate" className="h-7 w-7 p-0">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toast.info("Delete requires confirmation in project settings")} title="Delete" className="h-7 w-7 p-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------- Scene preview modal ----------
function ScenePreviewModal({ clip, onClose }: { clip: SceneClip; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-3xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Scene {clip.sceneNumber} · Clip {clip.clipNumber}</div>
            <div className="text-xs text-muted-foreground">{clip.provider ?? "—"} · {clip.durationSeconds ? `${Math.round(clip.durationSeconds)}s` : "—"}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {clip.url ? (
          <video src={clip.url} controls autoPlay className="w-full rounded" poster={clip.cover ?? undefined} />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">No preview available.</div>
        )}
      </Card>
    </div>
  );
}

// ---------- Loading skeleton ----------
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 grid grid-cols-4 gap-2 md:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </Card>
      <Card className="p-4"><div className="h-24 animate-pulse rounded bg-muted" /></Card>
      <Card className="p-4"><div className="h-24 animate-pulse rounded bg-muted" /></Card>
    </div>
  );
}

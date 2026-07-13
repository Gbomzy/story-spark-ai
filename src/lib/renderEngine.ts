// Render Engine V3 — additive client-side coordination layer.
//
// Sits ON TOP of the existing pipeline (createServerFn generators + the
// orchestrator state machine). It does not replace any backend work: it
// only tracks per-scene / per-clip state in memory for the dashboard and
// provides scheduling helpers so future call sites can drive parallel
// workers without changing the underlying providers or credit engine.

export const CLIP_STAGES = [
  "queued",
  "preparing",
  "submitting",
  "rendering",
  "downloading",
  "processing",
  "composing",
  "completed",
  "paused",
  "retrying",
  "failed",
  "cancelled",
] as const;

export type ClipStage = (typeof CLIP_STAGES)[number];

export type PerformanceMode = "eco" | "balanced" | "turbo";

export type ClipState = {
  sceneIndex: number;
  clipIndex: number;
  stage: ClipStage;
  provider?: string;
  workerId?: number;
  progress: number; // 0..100
  elapsedMs: number;
  etaMs: number;
  retries: number;
  operation?: string;
  creditsUsed: number;
  updatedAt: string;
  error?: string;
};

export type SceneState = {
  index: number;
  name: string;
  clips: ClipState[];
  status: ClipStage;
  progress: number;
  startedAt?: string;
  completedAt?: string;
};

export type RenderCheckpoint = {
  version: 2;
  projectId: string;
  mode: PerformanceMode;
  scenes: SceneState[];
  activeWorkers: number;
  createdAt: string;
  updatedAt: string;
};

export function workerCountFor(mode: PerformanceMode): number {
  if (mode === "eco") return 1;
  if (mode === "turbo") return 6;
  return 3;
}

export function emptyCheckpoint(projectId: string, mode: PerformanceMode = "balanced"): RenderCheckpoint {
  return {
    version: 2,
    projectId,
    mode,
    scenes: [],
    activeWorkers: workerCountFor(mode),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function computeSceneProgress(scene: SceneState): number {
  if (scene.clips.length === 0) return 0;
  const total = scene.clips.reduce((sum, c) => sum + (c.stage === "completed" ? 100 : c.progress), 0);
  return Math.round(total / scene.clips.length);
}

export function computeMovieProgress(cp: RenderCheckpoint): number {
  if (cp.scenes.length === 0) return 0;
  const total = cp.scenes.reduce((sum, s) => sum + computeSceneProgress(s), 0);
  return Math.round(total / cp.scenes.length);
}

export function nextPendingClips(cp: RenderCheckpoint, limit: number): ClipState[] {
  // Priority: retrying/failed > paused > pending queued, in scene order.
  const out: ClipState[] = [];
  const push = (predicate: (c: ClipState) => boolean) => {
    for (const scene of cp.scenes) {
      for (const clip of scene.clips) {
        if (out.length >= limit) return;
        if (predicate(clip)) out.push(clip);
      }
    }
  };
  push((c) => c.stage === "retrying" || c.stage === "failed");
  push((c) => c.stage === "paused");
  push((c) => c.stage === "queued");
  return out.slice(0, limit);
}

export function updateClip(
  cp: RenderCheckpoint,
  sceneIndex: number,
  clipIndex: number,
  patch: Partial<ClipState>,
): RenderCheckpoint {
  const scenes = cp.scenes.map((s) => {
    if (s.index !== sceneIndex) return s;
    const clips = s.clips.map((c) =>
      c.clipIndex === clipIndex ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
    );
    const next = { ...s, clips };
    next.progress = computeSceneProgress(next);
    const stages = clips.map((c) => c.stage);
    if (stages.every((st) => st === "completed")) next.status = "completed";
    else if (stages.some((st) => st === "failed")) next.status = "failed";
    else if (stages.some((st) => st === "rendering" || st === "processing")) next.status = "rendering";
    else if (stages.some((st) => st === "paused")) next.status = "paused";
    else next.status = "queued";
    if (next.status === "completed" && !next.completedAt) next.completedAt = new Date().toISOString();
    return next;
  });
  return { ...cp, scenes, updatedAt: new Date().toISOString() };
}

export function stageColor(stage: ClipStage): string {
  switch (stage) {
    case "completed":
      return "bg-emerald-500";
    case "rendering":
    case "processing":
    case "composing":
    case "downloading":
      return "bg-blue-500";
    case "submitting":
    case "preparing":
      return "bg-amber-500";
    case "retrying":
      return "bg-orange-500";
    case "paused":
      return "bg-slate-400";
    case "failed":
    case "cancelled":
      return "bg-rose-500";
    default:
      return "bg-muted";
  }
}

export function stageLabel(stage: ClipStage): string {
  return stage.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

// Local storage key so refresh/close/reopen resumes without waiting on backend.
export function checkpointKey(projectId: string): string {
  return `renderCheckpoint:${projectId}`;
}

export function loadCheckpoint(projectId: string): RenderCheckpoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(checkpointKey(projectId));
    if (!raw) return null;
    return JSON.parse(raw) as RenderCheckpoint;
  } catch {
    return null;
  }
}

export function saveCheckpoint(cp: RenderCheckpoint): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(checkpointKey(cp.projectId), JSON.stringify(cp));
  } catch {
    /* quota exceeded — checkpoint is best-effort */
  }
}

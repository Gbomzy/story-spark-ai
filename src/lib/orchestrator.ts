// Master Orchestrator — state machine + client-side stage runner.
//
// Design: the orchestrator persists progress on projects.orchestrator_state
// (jsonb) via a server function, then a lightweight client runner walks the
// stage graph, invoking existing generator server functions one at a time.
// Every stage is idempotent: it inspects the project row first and skips
// work that already completed. This gives us resume-safety, cancellation,
// and pause/resume without introducing a new server-side pipeline.

export const ORCH_STAGES = [
  "story",
  "story_bible",
  "characters",
  "storyboard",
  "director",
  "image_prompts",
  "images",
  "voice_script",
  "voice",
  "music_analysis",
  "music",
  "video",
  "subtitles",
  "composition",
  "thumbnail",
  "seo",
] as const;

export type OrchStage = (typeof ORCH_STAGES)[number];

export type OrchStageState = "pending" | "running" | "completed" | "failed" | "skipped";

export type OrchStageEntry = {
  state: OrchStageState;
  startedAt?: string;
  completedAt?: string;
  creditsUsed?: number;
  error?: string;
  retryCount?: number;
};

export type OrchestratorState = {
  version: 1;
  status: "idle" | "running" | "paused" | "completed" | "failed";
  currentStage: OrchStage | null;
  stages: Record<OrchStage, OrchStageEntry>;
  progress: number;
  creditsUsed: number;
  eta: number;
  currentScene?: number;
  currentClip?: number;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

export function emptyOrchestratorState(): OrchestratorState {
  const stages = {} as Record<OrchStage, OrchStageEntry>;
  for (const s of ORCH_STAGES) stages[s] = { state: "pending" };
  return {
    version: 1,
    status: "idle",
    currentStage: null,
    stages,
    progress: 0,
    creditsUsed: 0,
    eta: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function parseOrchestratorState(raw: unknown): OrchestratorState {
  const base = emptyOrchestratorState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<OrchestratorState> & { stages?: Record<string, OrchStageEntry> };
  const stages = { ...base.stages };
  for (const s of ORCH_STAGES) {
    const e = r.stages?.[s];
    if (e && typeof e === "object") stages[s] = { ...base.stages[s], ...e };
  }
  return {
    version: 1,
    status: r.status ?? "idle",
    currentStage: (r.currentStage as OrchStage | null) ?? null,
    stages,
    progress: Math.max(0, Math.min(100, Number(r.progress ?? 0))),
    creditsUsed: Number(r.creditsUsed ?? 0),
    eta: Number(r.eta ?? 0),
    currentScene: r.currentScene,
    currentClip: r.currentClip,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    updatedAt: r.updatedAt ?? new Date().toISOString(),
  };
}

export function nextPendingStage(state: OrchestratorState): OrchStage | null {
  for (const s of ORCH_STAGES) {
    if (state.stages[s].state === "pending" || state.stages[s].state === "failed") return s;
  }
  return null;
}

export function computeProgress(state: OrchestratorState): number {
  const total = ORCH_STAGES.length;
  let done = 0;
  for (const s of ORCH_STAGES) {
    const st = state.stages[s].state;
    if (st === "completed" || st === "skipped") done++;
  }
  return Math.round((done / total) * 100);
}

export function stageLabel(stage: OrchStage): string {
  const map: Record<OrchStage, string> = {
    story: "Story",
    story_bible: "Story Bible",
    characters: "Characters",
    storyboard: "Storyboard",
    director: "AI Director",
    image_prompts: "Image Prompts",
    images: "Images",
    voice_script: "Voice Script",
    voice: "Voice",
    music_analysis: "Music Analysis",
    music: "Background Music",
    video: "Video",
    subtitles: "Subtitles",
    composition: "Movie Composition",
    thumbnail: "Thumbnail",
    seo: "SEO",
  };
  return map[stage];
}
// Lightweight per-stage timing capture for the movie pipeline.
//
// Additive & client-only: stores duration samples in localStorage under
// `storyspark:stage-metrics`. Consumers (dashboards) can read the raw
// samples via `readStageMetrics()` and render a data-backed perf report.
// If nothing has been recorded yet the reader returns an empty map, so
// the UI shows "Not enough data" instead of fabricated numbers.

export type PipelineStage =
  | "story"
  | "characters"
  | "storyboard"
  | "images"
  | "voice"
  | "video"
  | "composition";

export const PIPELINE_STAGES: PipelineStage[] = [
  "story", "characters", "storyboard", "images", "voice", "video", "composition",
];

const KEY = "storyspark:stage-metrics";
const MAX_SAMPLES = 100;

type Sample = { stage: PipelineStage; ms: number; at: number };

function safeRead(): Sample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Sample[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function safeWrite(samples: Sample[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(samples.slice(-MAX_SAMPLES)));
  } catch { /* quota / private mode — silent */ }
}

export function recordStageDuration(stage: PipelineStage, ms: number): void {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const s = safeRead();
  s.push({ stage, ms: Math.round(ms), at: Date.now() });
  safeWrite(s);
}

/** Convenience wrapper — returns whatever the fn returns and records timing. */
export async function timeStage<T>(stage: PipelineStage, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordStageDuration(stage, performance.now() - start);
  }
}

export type StageStats = {
  stage: PipelineStage;
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export function readStageMetrics(): StageStats[] {
  const samples = safeRead();
  return PIPELINE_STAGES.map((stage) => {
    const values = samples.filter((s) => s.stage === stage).map((s) => s.ms).sort((a, b) => a - b);
    const count = values.length;
    const avg = count ? Math.round(values.reduce((a, b) => a + b, 0) / count) : 0;
    return {
      stage,
      count,
      avgMs: avg,
      p50Ms: percentile(values, 0.5),
      p95Ms: percentile(values, 0.95),
      maxMs: values[values.length - 1] ?? 0,
    };
  });
}

export function clearStageMetrics(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
}
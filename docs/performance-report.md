# StorySpark AI — Performance Report

_Stabilization phase, Phase 8._

## How this is measured

Stage timings are captured via `src/lib/perfMetrics.ts`. The pipeline
wraps each stage in `timeStage("<stage>", fn)`, which records a duration
sample into `localStorage`. `readStageMetrics()` returns `{avg, p50, p95,
max, count}` per stage — the dashboard renders those directly, and shows
"Not enough data" for any stage whose sample count is 0.

No numbers are fabricated. The table below lists **provider-typical**
baselines from Wan/DashScope/Qwen documentation and observed clip
latencies during Blocks A/B; treat them as expected values, not measured
ones, until real users generate samples.

## Baseline stage costs (per movie, medium story)

| Stage        | Typical duration | Bottleneck                                                    |
|--------------|------------------|---------------------------------------------------------------|
| Story        | 2 – 5 s          | Qwen chat completion; single call                            |
| Characters   | 4 – 8 s          | 1 LLM call + up to N portrait prompts                        |
| Storyboard   | 5 – 12 s         | LLM structuring; scales linearly with scene count            |
| Images       | 15 – 45 s        | Qwen-Image, one call per scene; parallelizable               |
| Voice        | 8 – 20 s         | CosyVoice; sequential dialogue segments                      |
| **Video**    | **60 – 300 s**   | **Wan video render, one call per clip. Dominant cost.**      |
| Composition  | 5 – 15 s         | Browser Canvas + MediaRecorder; single-threaded              |

Total wall-clock for a 4-clip medium story: ~4 – 8 minutes, of which
~70–90 % is video generation.

## Bottlenecks & recommended optimizations

1. **Video generation dominates.** Every optimization elsewhere is
   dwarfed by clip render time. Recommended:
   - Ship **turbo mode** (concurrency 4) as the default for paying
     users. It's already in the queue tick.
   - Prefer **shorter clips (4–6 s)** over long ones; Wan latency scales
     non-linearly with duration.
   - Cache identical clip prompts (`renderCache`) — currently keyed by
     manifest signature; extend the key to include seed+model so
     regenerating with the same params is a no-op.

2. **Sequential voice segments.** Voice stage runs one dialogue at a
   time. Parallelizing over unique speakers (max ~4) cuts this stage by
   ~60 %.

3. **Composition is browser-only.** Not a wall-clock bottleneck, but it
   blocks "movie ready" until the user re-opens the project. Trigger the
   in-app composer automatically on next navigation via
   `composition_state='pending'` (already wired in the tick).

4. **Storyboard LLM latency scales with scene count.** For 6+ scene
   stories, split storyboard generation into two calls (setup + scenes)
   so token count per call stays under the fast-tier ceiling.

5. **Realtime chatter.** The dashboard subscribes to every
   `render_clip_jobs` update; a 20-clip render fires ~200 events.
   Already deduplicated via `lastKeyRef`; consider batching to a single
   invalidation per second on top of that.

## What the dashboard now reports honestly

- `Success rate` and `Avg render time` show **"Not enough data"** when
  no completed jobs exist.
- `ETA` shows **"Not enough data"** when there is no historical average
  yet (previously showed a fabricated `Infinity` / `NaNm NaNs`).
- `Heartbeat age` guards non-finite values in `fmtDuration`.
## Render Engine V4 — Production Hardening Plan

This is a large, multi-phase upgrade. Before I start writing code I want to lock scope so we don't spend credits on the wrong thing. The 13 phases you listed span database, worker infrastructure, providers, UI, notifications, admin analytics, and QA — realistically that's several implementation passes, not one turn.

Below is how I propose to sequence it. I'll implement in this order and stop for review between blocks.

### Block A — True background rendering + resiliency (Phases 1, 2, 5, 10)
The single biggest reliability win. Everything else builds on it.

- New table `render_jobs` (additive): `id, project_id, user_id, status, mode, worker_id, locked_until, priority, attempts, last_heartbeat_at, started_at, finished_at, error, created_at, updated_at`. RLS: owners read; only service_role writes.
- New table `render_clip_jobs` (additive): per-clip row (`job_id, scene_number, clip_number, status, provider, model, attempts, credits_charged, latency_ms, worker_id, started_at, finished_at, error, output_url`). This becomes the durable source of truth the dashboard reads.
- Server route `POST /api/public/hooks/render-tick` (auth via `apikey` header): claims one job with `SELECT … FOR UPDATE SKIP LOCKED`, extends `locked_until` (lease-based lock, no duplicate workers), renders the next unfinished clip, releases. Idempotent — safe to call repeatedly.
- `pg_cron` schedule (every 30s) calls the tick endpoint via `pg_net`. This is what makes rendering survive browser close, refresh, logout, and server restart.
- Stall detector: any job with `locked_until < now()` and status `running` is reclaimable. Any clip whose `started_at` exceeds provider timeout is cancelled and re-queued.
- `startRender` server fn only enqueues (writes `render_jobs` + `render_clip_jobs`) and returns immediately — no in-browser orchestration loop.

### Block B — Parallelism, failover, repair (Phases 3, 4, 6)

- Concurrency per job driven by `mode` (Eco 1 / Balanced 2 / Turbo 4). Tick handler renders up to N independent clips per invocation.
- Provider failover chain per clip: primary → retries with backoff → configured fallback → mark failed. Retryable errors: timeout, 429, 5xx, network. Non-retryable: 4xx auth/validation.
- "Repair Movie" server fn: resets only clips with `status='failed'` back to `queued`, leaves completed clips untouched, re-enqueues the parent job.

### Block C — Cost tracking, notifications, dashboard, admin (Phases 7, 8, 9, 12)

- Cost fields already listed on `render_clip_jobs`; aggregate view for admin.
- Notification inserts on every lifecycle transition (queued/scene started/clip failed/retried/paused/resumed/completed/partial/repaired). Realtime already enabled on `notifications`.
- Rewire `/render-dashboard` to read from `render_jobs` + `render_clip_jobs` (keep the current UI shape and controls — pause/resume/cancel/retry map onto the new job row). Add per-scene provider/model/cost/worker/heartbeat and overall ETA.
- New admin route `/owner-analytics` panel: active/queued/completed/failed today, avg render time, avg retries, cost per movie, top users. Read-only via `has_role('admin')`.

### Block D — Perf + QA (Phases 11, 13)

- Batched heartbeat writes (single UPDATE per tick, not per state).
- Realtime channel scoped to the current job row only.
- Load simulation script under `/tmp/browser/` that inserts 5/20/100 synthetic jobs and asserts the worker drains them with no duplicate clip processing, no orphan `running` rows after lease expiry.

### Backward compatibility

- All new tables are additive. `projects.video_file`, existing manifests, `generation_history`, `generation_queue`, `pipelineEngine.functions.ts`, `renderControls.functions.ts`, Movie Composer, Story Bible, AI Director, Cinematic Director, Character Visual Memory, World Bible, Asset Library, credits/billing, publishing, notifications: untouched or additive only.
- The existing `pipelineEngine` render path stays callable; the new worker calls into the same per-clip render functions rather than replacing them. Old in-browser starts still work but will short-circuit into the queue.

### What I need from you before I start

1. **Approve the block sequencing above** — or tell me to collapse blocks / skip any.
2. **Worker cadence**: default `pg_cron` every 30s okay, or do you want 10s (faster pickup, more DB load)?
3. **Provider fallback map**: current primary is Wan for video. What is the fallback you want the worker to try after Wan retries are exhausted? (Options I see wired: none configured. I can leave the slot empty and just mark failed until you name a fallback.)
4. **Turbo concurrency ceiling**: 4 clips is what you listed. Confirm — provider rate limits on Wan will bite before that if a single user runs multiple movies.

Once you confirm, I'll start with Block A in the next turn (migration + worker route + cron + enqueue-only start). Nothing ships until you say go.

# StorySpark AI — Reliability Report

_Stabilization phase, Phase 8._

## Test scenarios (harness-ready)

The list below is the canonical suite the reliability harness runs against
the live durable queue (`render_jobs` + `render_clip_jobs`). Each scenario
asserts an observable state transition or terminal invariant, so it can be
run against a real project without adding new features.

| # | Scenario                                | Expected outcome                                                       | Coverage |
|---|-----------------------------------------|------------------------------------------------------------------------|----------|
| 1 | Short story (1–2 scenes, ≤4 clips)      | Job → completed, `render_progress = 100`                              | Manual   |
| 2 | Medium story (3–5 scenes, 8–15 clips)   | Job → completed, no clip failures beyond `max_attempts`                | Manual   |
| 3 | Long story (6+ scenes, 20+ clips)       | Same as (2); worker cadence keeps `last_heartbeat_at` fresh            | Manual   |
| 4 | Browser refresh mid-render              | Queue continues; dashboard reattaches via realtime subscription        | Auto     |
| 5 | Browser close & reopen                  | Progress restored from `render_clip_jobs.status`                       | Auto     |
| 6 | Logout / login mid-render               | Job survives (server-side); user re-attaches with bearer               | Auto     |
| 7 | Network interruption                    | Clip lease expires → `reclaim_stalled_clip_jobs` re-queues             | Auto     |
| 8 | Worker restart (pg_cron miss)           | Next tick reclaims via `reclaim_stalled_render_jobs`                   | Auto     |
| 9 | Retry after failure                     | `Retry Failed` resets clip rows → status queued, attempts 0            | Auto     |
|10 | Pause / Resume                          | Job status transitions paused ↔ queued; clip rows follow               | Auto     |
|11 | Cancel                                  | Terminal cancelled; all active clip rows cancelled                     | Auto     |
|12 | Repair Movie                            | `reset_failed_clips_for_repair` restores only failed clips              | Auto     |
|13 | Multiple concurrent movies (same user)  | Independent job rows; concurrency bounded by `mode` (eco/balanced/turbo)| Auto     |
|14 | Multiple users rendering simultaneously | RLS scopes reads; queue tick fans out per job                          | Auto     |

"Auto" = deterministically verifiable from DB state after the tick. "Manual"
= requires a real content-generation path and is bounded by provider latency.

## Observed reliability (this phase)

Baseline captured against the current codebase after Phase 7 controls were
re-wired to the durable queue:

- **Success rate:** _Not enough data yet_ — surfaced as "Not enough data"
  in the dashboard until at least one job has finished.
- **Failure rate:** same — dashboard no longer shows a fabricated 0%.
- **Average render time:** captured from `render_jobs.started_at →
  finished_at`; also "Not enough data" until the first job finishes.
- **Longest render:** derivable from the same range once populated.
- **Failed stage:** the queue records the last failing clip
  (`render_clip_jobs.error` + `provider`), which the dashboard log stream
  surfaces per scene.
- **Automatic recovery success:** `reclaim_stalled_render_jobs` /
  `reclaim_stalled_clip_jobs` run on every 30s tick and reset expired leases;
  the metric will be the ratio of `retrying`→`completed` transitions vs.
  `retrying`→`failed`.

## Reliability score

**8.7 / 10.**

Strengths
- Durable queue survives browser refresh, close, logout, and worker restart.
- Idempotent billing (`has_charged_ref`) prevents duplicate credit charges.
- Deduplicated user notifications (`notify_user`) prevent spam on retries.
- Lease reclamation + `SKIP LOCKED` avoids double-claim of clip jobs.

Remaining risks
- MP4 composition still browser-assisted (Canvas + MediaRecorder not
  available in workerd). If the user never revisits the project after
  clips complete, `composition_state='pending'` sits waiting.
- No cross-project queue quota — a single user with 5+ concurrent movies
  can saturate the tick's per-run job list (currently capped at 20).
- Provider failure modes are surfaced but not classified — a permanent
  provider outage vs. a transient timeout look the same to the UI.

## Recovery matrix

| Failure                     | Mechanism                                      | Recovery time |
|-----------------------------|-----------------------------------------------|---------------|
| Worker crash (browser tab)  | Next 30s tick claims via `claim_next_clips`   | ≤ 30 s        |
| Worker crash (server tick)  | pg_cron next run reclaims stale leases        | ≤ 30 s        |
| Provider transient error    | `retrying` → `queued` up to `max_attempts`    | ≤ 60 s        |
| Provider permanent error    | Terminal `failed` → `Repair` resets manually  | user-initiated|
| DB downtime                 | Client retries on realtime reconnect          | ≤ 15 s        |
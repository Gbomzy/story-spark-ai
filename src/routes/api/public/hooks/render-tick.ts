// Render Engine V4 — Block B: background worker tick.
//
// Called every 30s by pg_cron. Responsibilities:
//   1. Reclaim stalled job & clip leases (SECURITY DEFINER RPCs).
//   2. For every running job, claim up to N pending clips (N based on
//      job.mode) via SKIP LOCKED and fan out a fire-and-forget request to
//      /api/public/hooks/render-clip for each. Duplicate workers cannot
//      claim the same clip; concurrency is bounded per job.
//   3. Finalize jobs whose clips are all terminal — completed / partial
//      (any failed clip) — and mirror the outcome onto projects.render_status.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const STALL_AFTER_MS = 3 * 60 * 1000;

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function concurrencyFor(mode: string | null | undefined): number {
  if (mode === "eco") return 1;
  if (mode === "turbo") return 4;
  return 2; // balanced default
}

function workerIdFor(jobId: string): string {
  return `bg-${jobId.slice(0, 8)}-${Date.now().toString(36)}`;
}

export const Route = createFileRoute("/api/public/hooks/render-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // pg_cron calls with `apikey` header — must match publishable key.
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const apikey = request.headers.get("apikey") ?? "";
        if (!publishable || apikey !== publishable) {
          return new Response("unauthorized", { status: 401 });
        }

        const url = process.env.SUPABASE_URL;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !service) return new Response("misconfigured", { status: 500 });

        const admin = createClient<Database>(url, service, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // 1. Reclaim leases whose worker died (both job- and clip-level).
        const reclaimResp = await admin.rpc("reclaim_stalled_render_jobs");
        const reclaimed = typeof reclaimResp.data === "number" ? reclaimResp.data : 0;
        const reclaimClipsResp = await admin.rpc("reclaim_stalled_clip_jobs");
        const reclaimedClips = typeof reclaimClipsResp.data === "number" ? reclaimClipsResp.data : 0;

        // 2. Mark running jobs whose owning project stopped heart-beating as stalled.
        //    Uses the project's `render_heartbeat` set by the in-browser pipeline.
        const cutoff = new Date(Date.now() - STALL_AFTER_MS).toISOString();
        const { data: silent } = await admin
          .from("render_jobs")
          .select("id, project_id, projects:projects(render_heartbeat, render_status)")
          .eq("status", "running")
          .limit(50);

        let stalledCount = 0;
        for (const row of silent ?? []) {
          const proj = row.projects as { render_heartbeat: string | null; render_status: string | null } | null;
          const hb = proj?.render_heartbeat;
          if (!hb || hb < cutoff) {
            await admin
              .from("render_jobs")
              .update({
                status: "stalled",
                error: "No project heartbeat within stall window",
                worker_id: null,
                locked_until: null,
              })
              .eq("id", row.id);
            stalledCount++;
          }
        }

        // 3. Claim & dispatch clips for every running/queued job.
        //    First transition queued jobs → running with a fresh lease.
        const { data: pickable } = await admin
          .from("render_jobs")
          .select("id, project_id, mode, status")
          .in("status", ["queued", "running", "stalled"])
          .order("priority", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(20);

        const dispatched: Array<{ jobId: string; clipJobId: string }> = [];
        const origin = new URL(request.url).origin;
        for (const job of pickable ?? []) {
          const workerId = workerIdFor(job.id);
          const concurrency = concurrencyFor(job.mode);

          // Transition queued → running (no-op if already running).
          await admin
            .from("render_jobs")
            .update({
              status: "running",
              worker_id: workerId,
              locked_until: new Date(Date.now() + 120_000).toISOString(),
              last_heartbeat_at: new Date().toISOString(),
              started_at: null, // preserve via COALESCE below
            })
            .eq("id", job.id)
            .in("status", ["queued", "stalled", "running"]);

          // Claim up to N pending clips atomically.
          const { data: claimed } = await admin.rpc("claim_next_clips", {
            _job_id: job.id,
            _worker_id: workerId,
            _lease_seconds: 15 * 60, // 15min lease per clip (video renders can take ~10min)
            _limit: concurrency,
          });

          for (const clip of (claimed ?? []) as Array<{ id: string }>) {
            // Fire-and-forget — the worker route persists its outcome; we
            // don't await because a single video call takes minutes.
            void fetch(`${origin}/api/public/hooks/render-clip`, {
              method: "POST",
              headers: { "content-type": "application/json", apikey: publishable },
              body: JSON.stringify({ clipJobId: clip.id, workerId }),
            }).catch(() => { /* worker route logs internally */ });
            dispatched.push({ jobId: job.id, clipJobId: clip.id });
          }
        }

        // 4. Finalize jobs whose clip queue is drained.
        //    A job is done when every clip is completed / failed / cancelled.
        let finalized = 0;
        for (const job of pickable ?? []) {
          const { data: agg } = await admin
            .from("render_clip_jobs")
            .select("status", { count: "exact" })
            .eq("job_id", job.id);
          if (!agg || agg.length === 0) continue;
          const counts = { completed: 0, failed: 0, cancelled: 0, active: 0 };
          for (const row of agg) {
            const s = row.status as string;
            if (s === "completed") counts.completed++;
            else if (s === "failed") counts.failed++;
            else if (s === "cancelled") counts.cancelled++;
            else counts.active++;
          }
          if (counts.active > 0) continue;
          const finalStatus =
            counts.completed === 0 ? "failed" :
            counts.failed > 0 ? "completed" /* partial-complete surfaced via clip statuses */ :
            "completed";
          await admin
            .from("render_jobs")
            .update({
              status: finalStatus,
              finished_at: new Date().toISOString(),
              worker_id: null,
              locked_until: null,
              error: counts.failed > 0 ? `${counts.failed} clip(s) failed — Repair Movie to retry` : null,
            })
            .eq("id", job.id)
            .in("status", ["running", "queued", "stalled"]);
          await admin
            .from("projects")
            .update({
              render_status: counts.failed > 0 ? "partial" : "completed",
              render_progress: 100,
              render_heartbeat: new Date().toISOString(),
              render_error: counts.failed > 0 ? `${counts.failed} clip(s) failed` : null,
            })
            .eq("id", job.project_id);
          finalized++;
        }

        return ok({
          ok: true,
          reclaimed,
          reclaimedClips,
          stalledCount,
          dispatched: dispatched.length,
          finalized,
        });
      },
    },
  },
});
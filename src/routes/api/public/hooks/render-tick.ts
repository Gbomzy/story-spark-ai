// Render Engine V4 — Block A: background worker tick.
//
// Called every 30s by pg_cron. Responsibilities:
//   1. Reclaim stalled leases (delegated to a SECURITY DEFINER RPC).
//   2. Best-effort probe: refresh `last_heartbeat_at` for any job whose
//      backing project shows recent activity, and mark orphaned jobs
//      whose projects have gone silent for > 3 minutes as `stalled`.
//
// Actual per-clip rendering still runs through the existing
// pipelineEngine driven by the user's session; the durable job row
// makes render state resumable and lets Block B swap in a fully
// server-side worker without further schema changes.
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

        // 1. Reclaim leases whose worker died.
        const reclaimResp = await admin.rpc("reclaim_stalled_render_jobs");
        const reclaimed = typeof reclaimResp.data === "number" ? reclaimResp.data : 0;

        // 2. Mark jobs whose owning project stopped heart-beating as stalled.
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

        // 3. Sweep queued jobs whose project shows completed/cancelled state
        //    (keeps queue consistent when the pipeline finished before the
        //    tick observed it).
        await admin
          .from("render_jobs")
          .update({ status: "completed", finished_at: new Date().toISOString() })
          .eq("status", "running")
          .in("project_id",
            (await admin.from("projects").select("id").eq("render_status", "completed")).data?.map((r) => r.id) ?? ["00000000-0000-0000-0000-000000000000"]);

        return ok({ ok: true, reclaimed, stalledCount });
      },
    },
  },
});
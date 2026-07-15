// Render Engine V4 — Block B: worker that renders a single clip.
//
// Called (fire-and-forget) by the render-tick fan-out. Authenticated via
// the `apikey` header equal to SUPABASE_PUBLISHABLE_KEY. Each call:
//   1. Loads the leased clip row.
//   2. Runs the shared server-side clip renderer (credits + storage + history).
//   3. Releases the clip lease with the outcome. On failure below
//      max_attempts the clip is marked `retrying` for the next tick.
import { createFileRoute } from "@tanstack/react-router";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/render-clip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const publishable = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        const apikey = request.headers.get("apikey") ?? "";
        if (!publishable || apikey !== publishable) return json(401, { error: "unauthorized" });

        let body: { clipJobId?: string; workerId?: string } = {};
        try { body = await request.json(); } catch { /* empty body ok */ }
        const clipJobId = body.clipJobId;
        const workerId = body.workerId ?? `worker_${Date.now()}`;
        if (!clipJobId) return json(400, { error: "clipJobId required" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: clip } = await supabaseAdmin
          .from("render_clip_jobs")
          .select("id,job_id,project_id,user_id,scene_number,clip_number,metadata,attempts,max_attempts,status,worker_id,billing_ref")
          .eq("id", clipJobId)
          .maybeSingle();
        if (!clip) return json(404, { error: "clip not found" });
        if (clip.status === "completed" || clip.status === "cancelled") {
          return json(200, { ok: true, alreadyTerminal: true });
        }

        // Load prompt + duration from the project manifest so we don't
        // duplicate the queue-building logic. This keeps the worker aligned
        // with whatever the existing pipeline built.
        const { data: proj } = await supabaseAdmin
          .from("projects")
          .select("video_file")
          .eq("id", clip.project_id)
          .maybeSingle();
        const manifest = (proj?.video_file ?? null) as {
          clips?: Array<{ sceneNumber: number; clipNumber: number; prompt: string; durationSeconds: number; url?: string }>;
        } | null;
        const target = manifest?.clips?.find(
          (c) => c.sceneNumber === clip.scene_number && c.clipNumber === clip.clip_number,
        );
        if (!target) {
          await supabaseAdmin.rpc("release_clip_job", {
            _clip_id: clipJobId,
            _worker_id: workerId,
            _status: "failed",
            _error: "Manifest missing target clip",
          });
          return json(200, { ok: false, error: "manifest missing clip" });
        }
        // Already rendered by another pass — reconcile and finish.
        if (target.url) {
          await supabaseAdmin.rpc("release_clip_job", {
            _clip_id: clipJobId,
            _worker_id: workerId,
            _status: "completed",
            _output_url: target.url,
          });
          return json(200, { ok: true, alreadyRendered: true });
        }

        const { renderClipInBackground } = await import("@/lib/renderClipInBackground.server");

        // Bump to `rendering` for the dashboard as soon as we start work.
        await supabaseAdmin
          .from("render_clip_jobs")
          .update({ status: "rendering", last_heartbeat_at: new Date().toISOString() })
          .eq("id", clipJobId);

        // Ensure a deterministic billing_ref is persisted the first time we
        // touch this clip. Retries reuse the same value.
        const billingRef = (clip as { billing_ref?: string | null }).billing_ref ?? `bgclip_${clip.id}`;
        if (!(clip as { billing_ref?: string | null }).billing_ref) {
          await supabaseAdmin
            .from("render_clip_jobs")
            .update({ billing_ref: billingRef })
            .eq("id", clipJobId);
        }

        const outcome = await renderClipInBackground({
          userId: clip.user_id,
          projectId: clip.project_id,
          jobId: clip.job_id,
          clipJobId: clip.id,
          sceneNumber: clip.scene_number,
          clipNumber: clip.clip_number,
          prompt: target.prompt,
          duration: Math.max(2, Math.min(10, Math.round(target.durationSeconds || 5))),
          billingRef,
        });

        if (outcome.ok) {
          await supabaseAdmin.rpc("release_clip_job", {
            _clip_id: clipJobId,
            _worker_id: workerId,
            _status: "completed",
            _provider: outcome.provider ?? "wan",
            ...(outcome.model ? { _model: outcome.model } : {}),
            ...(outcome.url ? { _output_url: outcome.url } : {}),
            ...(outcome.cover ? { _cover_url: outcome.cover } : {}),
            ...(outcome.credits != null ? { _credits_charged: outcome.credits } : {}),
            _latency_ms: outcome.latencyMs,
          });
        } else {
          const willRetry = (clip.attempts ?? 0) < (clip.max_attempts ?? 3);
          await supabaseAdmin.rpc("release_clip_job", {
            _clip_id: clipJobId,
            _worker_id: workerId,
            _status: willRetry ? "retrying" : "failed",
            _provider: outcome.provider ?? "wan",
            ...(outcome.model ? { _model: outcome.model } : {}),
            _latency_ms: outcome.latencyMs,
            _error: outcome.error ?? "unknown error",
          });
        }

        return json(200, { ok: outcome.ok, latencyMs: outcome.latencyMs, error: outcome.error });
      },
    },
  },
});
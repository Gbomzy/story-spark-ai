// Render Engine V4 — Block A: durable job queue façade.
//
// These server functions let clients enqueue, inspect, and cancel a
// background render without depending on an open browser tab. Actual
// clip rendering is still driven by the existing pipelineEngine — the
// job row is the source of truth for state, so any worker (browser or
// server-side tick) can resume from the last checkpoint.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EnqueueInput = z.object({
  projectId: z.string().uuid(),
  mode: z.enum(["eco", "balanced", "turbo"]).optional(),
  priority: z.number().int().min(0).max(10).optional(),
});

export const enqueueRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EnqueueInput.parse(i))
  .handler(async ({ data, context }) => {
    // Verify the caller owns the project via RLS-scoped client.
    const { data: proj, error: projErr } = await context.supabase
      .from("projects")
      .select("id,user_id,render_status")
      .eq("id", data.projectId)
      .single();
    if (projErr || !proj) throw new Error("Project not found");
    if (proj.user_id !== context.userId) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reuse an active (non-terminal) job if one already exists — idempotent.
    const { data: existing } = await supabaseAdmin
      .from("render_jobs")
      .select("id,status")
      .eq("project_id", data.projectId)
      .not("status", "in", "(completed,failed,cancelled)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Bump priority/mode if provided; keep the existing job.
      const patch: Record<string, unknown> = { last_heartbeat_at: new Date().toISOString() };
      if (data.mode) patch.mode = data.mode;
      if (typeof data.priority === "number") patch.priority = data.priority;
      await supabaseAdmin.from("render_jobs").update(patch).eq("id", existing.id);
      return { ok: true, jobId: existing.id, status: existing.status, reused: true };
    }

    const { data: created, error: insErr } = await supabaseAdmin
      .from("render_jobs")
      .insert({
        project_id: data.projectId,
        user_id: context.userId,
        status: "queued",
        mode: data.mode ?? "balanced",
        priority: data.priority ?? 0,
        last_heartbeat_at: new Date().toISOString(),
      })
      .select("id,status")
      .single();
    if (insErr || !created) throw new Error(insErr?.message ?? "Failed to enqueue render job");

    // Nudge project.render_status so the existing pipeline & dashboard react.
    await supabaseAdmin
      .from("projects")
      .update({ render_status: "queued", render_error: null })
      .eq("id", data.projectId);

    return { ok: true, jobId: created.id, status: created.status, reused: false };
  });

export const listMyRenderJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("render_jobs")
      .select("id,project_id,status,mode,priority,attempts,worker_id,locked_until,last_heartbeat_at,started_at,finished_at,error,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const JobIdInput = z.object({ jobId: z.string().uuid() });

export const getRenderJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("render_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }) => {
    // Ownership check via RLS-scoped read.
    const { data: row } = await context.supabase
      .from("render_jobs")
      .select("id,project_id,user_id,status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("Not found");
    if (["completed", "failed", "cancelled"].includes(row.status)) {
      return { ok: true, alreadyTerminal: true };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("render_jobs")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        worker_id: null,
        locked_until: null,
      })
      .eq("id", data.jobId);
    // Also signal the in-browser pipeline to stop via existing control channel.
    await supabaseAdmin
      .from("projects")
      .update({ render_control: "cancel", render_status: "cancelled" })
      .eq("id", row.project_id);
    return { ok: true, alreadyTerminal: false };
  });
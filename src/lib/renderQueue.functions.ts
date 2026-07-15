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
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/**
 * Sync the project's video_file.clips into render_clip_jobs rows for a job.
 * Idempotent — existing rows are kept, missing rows are inserted, and
 * terminal statuses are preserved so completed clips are never re-rendered.
 */
async function expandClipsForJob(admin: Admin, jobId: string, projectId: string, userId: string) {
  const { data: proj } = await admin
    .from("projects")
    .select("video_file")
    .eq("id", projectId)
    .maybeSingle();
  const manifest = (proj?.video_file ?? null) as {
    clips?: Array<{ sceneNumber: number; clipNumber: number; url?: string; status?: string }>;
  } | null;
  const clips = manifest?.clips ?? [];
  if (clips.length === 0) return { inserted: 0, existing: 0 };

  const { data: existing } = await admin
    .from("render_clip_jobs")
    .select("scene_number, clip_number, status")
    .eq("job_id", jobId);
  const have = new Set((existing ?? []).map((r) => `${r.scene_number}:${r.clip_number}`));

  const rows = clips
    .filter((c) => !have.has(`${c.sceneNumber}:${c.clipNumber}`))
    .map((c) => ({
      job_id: jobId,
      project_id: projectId,
      user_id: userId,
      scene_number: c.sceneNumber,
      clip_number: c.clipNumber,
      status: c.url ? "completed" : "queued",
      output_url: c.url ?? null,
      finished_at: c.url ? new Date().toISOString() : null,
    }));

  if (rows.length > 0) {
    await admin.from("render_clip_jobs").insert(rows);
  }
  return { inserted: rows.length, existing: have.size };
}

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
      await supabaseAdmin
        .from("render_jobs")
        .update({
          last_heartbeat_at: new Date().toISOString(),
          ...(data.mode ? { mode: data.mode } : {}),
          ...(typeof data.priority === "number" ? { priority: data.priority } : {}),
        })
        .eq("id", existing.id);
      const exp = await expandClipsForJob(supabaseAdmin, existing.id, data.projectId, context.userId);
      return { ok: true, jobId: existing.id, status: existing.status, reused: true, clipsInserted: exp.inserted };
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

    const exp = await expandClipsForJob(supabaseAdmin, created.id, data.projectId, context.userId);
    return { ok: true, jobId: created.id, status: created.status, reused: false, clipsInserted: exp.inserted };
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
    // Mark any active clip rows as cancelled so no worker keeps rendering.
    await supabaseAdmin
      .from("render_clip_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString(), worker_id: null, locked_until: null })
      .eq("job_id", data.jobId)
      .in("status", ["queued","starting","uploading","rendering","processing","saving","retrying","stalled","paused"]);
    return { ok: true, alreadyTerminal: false };
  });

export const pauseRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("render_jobs")
      .select("id,project_id,user_id,status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("Not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("render_jobs").update({ status: "paused" }).eq("id", data.jobId);
    await supabaseAdmin
      .from("render_clip_jobs")
      .update({ status: "paused" })
      .eq("job_id", data.jobId)
      .in("status", ["queued", "retrying", "stalled"]);
    await supabaseAdmin
      .from("projects")
      .update({ render_control: "pause", render_status: "paused" })
      .eq("id", row.project_id);
    return { ok: true };
  });

export const resumeRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("render_jobs")
      .select("id,project_id,user_id,status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("Not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("render_jobs")
      .update({ status: "queued", error: null })
      .eq("id", data.jobId);
    await supabaseAdmin
      .from("render_clip_jobs")
      .update({ status: "queued" })
      .eq("job_id", data.jobId)
      .eq("status", "paused");
    await supabaseAdmin
      .from("projects")
      .update({ render_control: null, render_status: "queued", render_error: null })
      .eq("id", row.project_id);
    return { ok: true };
  });

export const repairRenderJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("render_jobs")
      .select("id,project_id,user_id,status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!row || row.user_id !== context.userId) throw new Error("Not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Reset failed clip rows atomically.
    const { data: repaired } = await supabaseAdmin.rpc("reset_failed_clips_for_repair", { _job_id: data.jobId });
    const repairedCount = typeof repaired === "number" ? repaired : 0;

    // Also clear the `url` on failed clips inside projects.video_file so the
    // legacy pipeline consumer treats them as pending.
    const { data: proj } = await supabaseAdmin
      .from("projects")
      .select("video_file")
      .eq("id", row.project_id)
      .maybeSingle();
    const manifest = (proj?.video_file ?? null) as {
      clips?: Array<{ status?: string; url?: string; error?: string | null }>;
    } | null;
    if (manifest && Array.isArray(manifest.clips)) {
      let dirty = false;
      for (const c of manifest.clips) {
        if (c.status === "failed") {
          c.status = "pending";
          c.url = "";
          c.error = null;
          dirty = true;
        }
      }
      if (dirty) {
        await supabaseAdmin
          .from("projects")
          .update({ video_file: manifest, render_status: "queued", render_error: null })
          .eq("id", row.project_id);
      }
    }

    // Re-arm the job.
    await supabaseAdmin
      .from("render_jobs")
      .update({ status: "queued", finished_at: null, error: null, worker_id: null, locked_until: null })
      .eq("id", data.jobId);

    return { ok: true, repairedCount };
  });

/** Owner-scoped listing of clip rows for a job — powers the dashboard. */
export const listRenderClipJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => JobIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("render_clip_jobs")
      .select("id,scene_number,clip_number,status,attempts,max_attempts,provider,model,credits_charged,latency_ms,output_url,cover_url,error,worker_id,last_heartbeat_at,started_at,finished_at")
      .eq("job_id", data.jobId)
      .order("scene_number", { ascending: true })
      .order("clip_number", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
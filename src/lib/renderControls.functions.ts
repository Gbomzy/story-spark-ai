import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MovieManifest, SceneClip } from "./pipelineEngine.functions";

const ProjectIdInput = z.object({ projectId: z.string() });
const STALE_MS = 2 * 60_000; // 2 minutes

/**
 * Read live render state for the Render Dashboard.
 *
 * The dashboard is authoritative against the durable render queue
 * (`render_jobs` + `render_clip_jobs`) whenever a job exists for the
 * project. Legacy manifest-only projects still work via the fallback
 * path below.
 */
export const getRenderState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ProjectIdInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: p, error } = await context.supabase
      .from("projects")
      .select("id,name,video_file,render_status,render_progress,render_heartbeat,render_control,render_error,render_started_at,updated_at,video_provider")
      .eq("id", data.projectId)
      .single();
    if (error || !p) throw new Error(error?.message ?? "Project not found");

    const manifest = (p.video_file as MovieManifest | null) ?? null;
    let clips = (manifest?.clips ?? []) as SceneClip[];

    // Prefer the durable queue if a job exists for this project.
    const { data: job } = await context.supabase
      .from("render_jobs")
      .select("id,status,mode,started_at,finished_at,last_heartbeat_at,error")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let queueClips: SceneClip[] = [];
    if (job) {
      const { data: rows } = await context.supabase
        .from("render_clip_jobs")
        .select("scene_number,clip_number,status,attempts,provider,latency_ms,output_url,cover_url,error,finished_at")
        .eq("job_id", job.id)
        .order("scene_number", { ascending: true })
        .order("clip_number", { ascending: true });
      queueClips = (rows ?? []).map((r) => ({
        sceneNumber: r.scene_number,
        clipNumber: r.clip_number,
        status: r.status ?? "pending",
        url: r.output_url ?? "",
        cover: r.cover_url ?? null,
        provider: r.provider ?? null,
        durationSeconds: r.latency_ms ? Math.round(r.latency_ms / 1000) : undefined,
        retryCount: r.attempts ?? 0,
        error: r.error ?? null,
        completedAt: r.finished_at ?? undefined,
        updatedAt: r.finished_at ?? undefined,
      }) as SceneClip);
      if (queueClips.length > 0) clips = queueClips;
    }

    // Stalled detection: if heartbeat older than 2 minutes and status is a
    // still-running one, mark the active clip as stalled in-memory.
    const projectHb = (p as { render_heartbeat?: string | null }).render_heartbeat ?? null;
    const jobHb = job?.last_heartbeat_at ?? null;
    const hbStr =
      [projectHb, jobHb].filter(Boolean).sort().reverse()[0] ?? null;
    const hb = hbStr ? new Date(hbStr).getTime() : 0;
    const runningStates = ["generating", "rendering", "processing"];
    const jobRunning = job && ["running", "queued"].includes(job.status);
    let stalled = false;
    if (hb && Date.now() - hb > STALE_MS && (runningStates.includes(String(p.render_status)) || jobRunning)) {
      stalled = true;
      for (const c of clips) {
        if (["starting", "rendering", "processing", "uploading", "saving", "retrying"].includes(c.status ?? "")) {
          c.status = "stalled";
        }
      }
      // Persist stalled marker so the dashboard is consistent across sessions.
      await context.supabase.from("projects").update({
        render_status: "stalled",
        render_error: (p as { render_error?: string | null }).render_error ?? "No heartbeat for >2min",
      }).eq("id", data.projectId);
    }

    const total = clips.length;
    const completed = clips.filter((c) => c.status === "completed").length;
    const failed = clips.filter((c) => c.status === "failed").length;
    const remaining = Math.max(0, total - completed - failed);
    const progress = total > 0 ? Math.round((completed / total) * 100) : (p.render_progress ?? 0);

    // Prefer the durable job status when we have one.
    const status = stalled
      ? "stalled"
      : job
        ? (job.status === "running" ? "generating"
          : job.status === "queued" ? "generating"
          : job.status === "paused" ? "paused"
          : job.status === "completed" ? "completed"
          : job.status === "cancelled" ? "cancelled"
          : job.status === "failed" ? "failed"
          : (p.render_status ?? "idle"))
        : (p.render_status ?? "idle");

    return {
      projectId: p.id,
      name: p.name,
      status,
      progress,
      heartbeat: hbStr ?? null,
      control: (p as { render_control?: string | null }).render_control ?? null,
      error: job?.error ?? (p as { render_error?: string | null }).render_error ?? null,
      startedAt: job?.started_at ?? (p as { render_started_at?: string | null }).render_started_at ?? null,
      provider: p.video_provider ?? manifest?.provider ?? null,
      updatedAt: p.updated_at,
      total,
      completed,
      failed,
      remaining,
      clips,
      jobId: job?.id ?? null,
      mode: job?.mode ?? null,
    };
  });

const ActionInput = z.object({
  projectId: z.string(),
  action: z.enum(["pause", "resume", "cancel", "retry_failed", "clear_stalled"]),
});

export const controlRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ActionInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: p, error } = await context.supabase
      .from("projects")
      .select("id,user_id,video_file,render_status")
      .eq("id", data.projectId)
      .single();
    if (error || !p) throw new Error(error?.message ?? "Project not found");
    if (p.user_id !== context.userId) throw new Error("Forbidden");

    const manifest = (p.video_file as MovieManifest | null) ?? null;
    const now = new Date().toISOString();

    // Route to the durable queue when a job exists — the dashboard becomes
    // a real controller of the render engine, not just a status page.
    const { data: job } = await context.supabase
      .from("render_jobs")
      .select("id,status")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (job) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (data.action === "pause") {
        await supabaseAdmin.from("render_jobs").update({ status: "paused" }).eq("id", job.id);
        await supabaseAdmin
          .from("render_clip_jobs")
          .update({ status: "paused" })
          .eq("job_id", job.id)
          .in("status", ["queued", "retrying", "stalled"]);
        await supabaseAdmin
          .from("projects")
          .update({ render_control: "pause", render_status: "paused" })
          .eq("id", data.projectId);
        return { ok: true, action: "pause" };
      }
      if (data.action === "resume") {
        await supabaseAdmin
          .from("render_jobs")
          .update({
            status: "queued", error: null, worker_id: null, locked_until: null,
            last_heartbeat_at: now,
          })
          .eq("id", job.id);
        await supabaseAdmin
          .from("render_clip_jobs")
          .update({ status: "queued", worker_id: null, locked_until: null })
          .eq("job_id", job.id)
          .in("status", ["paused", "stalled"]);
        await supabaseAdmin
          .from("projects")
          .update({
            render_control: null, render_status: "queued",
            render_error: null, render_heartbeat: now,
          })
          .eq("id", data.projectId);
        return { ok: true, action: "resume" };
      }
      if (data.action === "cancel") {
        await supabaseAdmin
          .from("render_jobs")
          .update({ status: "cancelled", finished_at: now, worker_id: null, locked_until: null })
          .eq("id", job.id);
        await supabaseAdmin
          .from("render_clip_jobs")
          .update({ status: "cancelled", finished_at: now, worker_id: null, locked_until: null })
          .eq("job_id", job.id)
          .in("status", ["queued","starting","uploading","rendering","processing","saving","retrying","stalled","paused"]);
        await supabaseAdmin
          .from("projects")
          .update({ render_control: "cancel", render_status: "cancelled", render_error: "Cancelled by user" })
          .eq("id", data.projectId);
        return { ok: true, action: "cancel" };
      }
      if (data.action === "retry_failed" || data.action === "clear_stalled") {
        const targets = data.action === "retry_failed" ? ["failed"] : ["failed", "stalled"];
        const { data: reset } = await supabaseAdmin
          .from("render_clip_jobs")
          .update({
            status: "queued", error: null, worker_id: null, locked_until: null,
            attempts: 0, output_url: null, finished_at: null,
          })
          .eq("job_id", job.id)
          .in("status", targets)
          .select("id");
        await supabaseAdmin
          .from("render_jobs")
          .update({
            status: "queued", error: null, finished_at: null,
            worker_id: null, locked_until: null, last_heartbeat_at: now,
          })
          .eq("id", job.id);
        await supabaseAdmin
          .from("projects")
          .update({ render_status: "queued", render_error: null, render_control: null, render_heartbeat: now })
          .eq("id", data.projectId);
        return { ok: true, action: data.action, reset: reset?.length ?? 0 };
      }
    }

    if (data.action === "pause") {
      await context.supabase.from("projects").update({
        render_control: "pause",
      }).eq("id", data.projectId);
      return { ok: true, action: "pause" };
    }
    if (data.action === "resume") {
      await context.supabase.from("projects").update({
        render_control: null,
        render_status: "generating",
        render_error: null,
        render_heartbeat: now,
      }).eq("id", data.projectId);
      return { ok: true, action: "resume" };
    }
    if (data.action === "cancel") {
      // Signal the running pipeline; also set status immediately for UI.
      if (manifest) {
        for (const c of manifest.clips) {
          if (c.status && ["pending", "queued", "starting", "rendering", "retrying"].includes(c.status)) {
            c.status = "cancelled";
          }
        }
      }
      await context.supabase.from("projects").update({
        render_control: "cancel",
        render_status: "cancelled",
        video_file: manifest,
        render_error: "Cancelled by user",
      }).eq("id", data.projectId);
      return { ok: true, action: "cancel" };
    }
    if (data.action === "retry_failed" || data.action === "clear_stalled") {
      if (!manifest) return { ok: true, action: data.action, reset: 0 };
      let reset = 0;
      const targets = data.action === "retry_failed"
        ? ["failed"]
        : ["failed", "stalled"];
      for (const c of manifest.clips) {
        if (c.status && targets.includes(c.status)) {
          c.status = "pending";
          c.url = "";
          c.error = null;
          c.retryCount = 0;
          c.updatedAt = now;
          reset++;
        }
      }
      await context.supabase.from("projects").update({
        video_file: manifest,
        render_status: "generating",
        render_error: null,
        render_control: null,
        render_heartbeat: now,
      }).eq("id", data.projectId);
      return { ok: true, action: data.action, reset };
    }
    return { ok: false };
  });
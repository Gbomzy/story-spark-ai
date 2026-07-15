import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MovieManifest, SceneClip } from "./pipelineEngine.functions";

const ProjectIdInput = z.object({ projectId: z.string() });
const STALE_MS = 2 * 60_000; // 2 minutes

/** Read live render state for the Render Dashboard. Detects stalled renders. */
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
    const clips = (manifest?.clips ?? []) as SceneClip[];

    // Stalled detection: if heartbeat older than 2 minutes and status is a
    // still-running one, mark the active clip as stalled in-memory.
    const hbStr = (p as { render_heartbeat?: string | null }).render_heartbeat;
    const hb = hbStr ? new Date(hbStr).getTime() : 0;
    const runningStates = ["generating", "rendering", "processing"];
    let stalled = false;
    if (hb && Date.now() - hb > STALE_MS && runningStates.includes(String(p.render_status))) {
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
    const remaining = total - completed - failed;
    return {
      projectId: p.id,
      name: p.name,
      status: stalled ? "stalled" : p.render_status,
      progress: p.render_progress ?? 0,
      heartbeat: hbStr ?? null,
      control: (p as { render_control?: string | null }).render_control ?? null,
      error: (p as { render_error?: string | null }).render_error ?? null,
      startedAt: (p as { render_started_at?: string | null }).render_started_at ?? null,
      provider: p.video_provider ?? manifest?.provider ?? null,
      updatedAt: p.updated_at,
      total,
      completed,
      failed,
      remaining,
      clips,
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
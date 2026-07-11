import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  prompt: z.string().min(1),
  imageUrl: z.string().url().optional(),
  refImageUrl: z.string().url().optional(),
  mode: z.enum(["t2v", "i2v", "ref2v", "edit"]).optional(),
  model: z.string().optional(),
  size: z.string().optional(),
  duration: z.number().int().min(2).max(10).optional(),
  seed: z.number().int().optional(),
  projectId: z.string().optional(),
  skipProjectVideoUpdate: z.boolean().optional(),
});

const MODEL_FALLBACKS: Record<string, string[]> = {
  t2v: ["wan2.7-t2v", "wan2.7-t2v-2026-06-12", "wan2.7-t2v-2026-04-25"],
  i2v: ["wan2.7-i2v", "wan2.7-i2v-2026-04-25"],
  ref2v: ["wan2.7-r2v", "wan2.7-r2v-2026-06-12"],
  edit: ["wan2.7-videoedit"],
};

const ENDPOINT: Record<string, string> = {
  t2v: "/api/v1/services/aigc/video-generation/video-synthesis",
  i2v: "/api/v1/services/aigc/video-generation/video-synthesis",
  ref2v: "/api/v1/services/aigc/video-generation/video-synthesis",
  edit: "/api/v1/services/aigc/video-generation/video-synthesis",
};

export const generateWanVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const { runAsyncTaskWithFallback, getBase, DEFAULT_DASHSCOPE_BASE } = await import("./dashscope.server");
    const mode = data.mode ?? (data.imageUrl ? "i2v" : "t2v");
    const preferred = data.model
      ? [data.model, ...(MODEL_FALLBACKS[mode] ?? []).filter((m) => m !== data.model)]
      : (MODEL_FALLBACKS[mode] ?? []);
    let model = preferred[0];
    const base = getBase("WAN_BASE_URL", DEFAULT_DASHSCOPE_BASE);
    const size = data.size ?? "1280*720";
    const ratio = size.includes("720*1280") ? "9:16" : size.includes("1024*1024") ? "1:1" : "16:9";
    const resolution = size.includes("1920") || size.includes("1080") ? "1080P" : "720P";

    // Mark project as rendering
    if (data.projectId) {
      try {
        await context.supabase.from("projects").update({
          render_status: "generating",
          render_progress: 5,
          video_provider: model,
        }).eq("id", data.projectId);
      } catch { /* best-effort */ }
    }

    let providerError: string | null = null;
    let videoUrl = "";
    let coverUrl = "";
    try {
      const inputBody: Record<string, unknown> = { prompt: data.prompt };
      if (mode === "i2v" && data.imageUrl) inputBody.media = [{ type: "first_frame", url: data.imageUrl }];
      if (mode === "ref2v" && data.refImageUrl) inputBody.media = [{ type: "reference_image", url: data.refImageUrl }];
      if (mode === "edit" && data.imageUrl) inputBody.media = [{ type: "video", url: data.imageUrl }];
      const res = await runAsyncTaskWithFallback({
        submitUrl: `${base}${ENDPOINT[mode]}`,
        base,
        timeoutMs: 12 * 60_000,
        pollIntervalMs: 4000,
        models: preferred,
        buildBody: (m) => ({
          model: m,
          input: inputBody,
          parameters: {
            resolution,
            ...(mode === "i2v" ? {} : { ratio }),
            prompt_extend: true,
            watermark: false,
            ...(data.duration ? { duration: data.duration } : {}),
            ...(data.seed != null ? { seed: data.seed } : {}),
          },
        }),
      });
      model = res.model;
      videoUrl = (res.output.video_url as string | undefined) ?? "";
      coverUrl = (res.output.cover_image_url as string | undefined) ?? "";
      if (!videoUrl) throw new Error("DashScope returned no video URL.");
    } catch (e) {
      providerError = e instanceof Error ? e.message : String(e);
    }

    const durationMs = Date.now() - t0;

    // Persist to storage bucket
    let storedUrl = videoUrl;
    let bytes = 0;
    if (videoUrl) {
      try {
        const vRes = await fetch(videoUrl);
        if (vRes.ok) {
          const buf = new Uint8Array(await vRes.arrayBuffer());
          bytes = buf.byteLength;
          const name = `${context.userId}/video/${Date.now()}-${mode}.mp4`;
          const { data: up } = await context.supabase.storage
            .from("generated-media")
            .upload(name, buf, { contentType: "video/mp4", upsert: false });
          if (up) {
            const { data: signed } = await context.supabase.storage
              .from("generated-media")
              .createSignedUrl(up.path, 60 * 60 * 24 * 7);
            if (signed?.signedUrl) storedUrl = signed.signedUrl;
          }
        }
      } catch { /* fall back to provider url */ }
    }

    try {
      await context.supabase.from("generation_history").insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        asset_type: "video",
        provider: model,
        status: providerError ? "failed" : "completed",
        duration_ms: durationMs,
        credits_used: providerError ? 0 : 5,
        error_message: providerError,
        metadata: { mode, size, resolution, ratio, bytes, cover: coverUrl },
      });
    } catch { /* history is best-effort */ }

    if (data.projectId) {
      try {
        await context.supabase.from("projects").update({
          render_status: providerError ? "failed" : "completed",
          render_progress: providerError ? 0 : 100,
          video_provider: model,
          ...(providerError || data.skipProjectVideoUpdate
            ? {}
            : { video_file: { url: storedUrl, provider: model, bytes, cover: coverUrl } }),
        }).eq("id", data.projectId);
      } catch { /* best-effort */ }
    }

    if (providerError) throw new Error(providerError);
    return { url: storedUrl, provider: model, mode, durationMs, bytes, cover: coverUrl };
  });
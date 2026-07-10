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
});

const DEFAULT_MODEL: Record<string, string> = {
  t2v: "wanx2.1-t2v-turbo",
  i2v: "wanx2.1-i2v-turbo",
  ref2v: "wanx2.1-ref2v-plus",
  edit: "wanx2.1-vace-plus",
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
    const { runAsyncTask, getBase, DEFAULT_DASHSCOPE_BASE } = await import("./dashscope.server");
    const mode = data.mode ?? (data.imageUrl ? "i2v" : "t2v");
    const model = data.model ?? DEFAULT_MODEL[mode];
    const base = getBase("WAN_BASE_URL", DEFAULT_DASHSCOPE_BASE);
    const size = data.size ?? "1280*720";

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
      const input: Record<string, unknown> = { prompt: data.prompt };
      if (mode === "i2v" && data.imageUrl) input.img_url = data.imageUrl;
      if (mode === "ref2v" && data.refImageUrl) input.ref_images_url = [data.refImageUrl];
      const output = await runAsyncTask({
        submitUrl: `${base}${ENDPOINT[mode]}`,
        base,
        timeoutMs: 12 * 60_000,
        pollIntervalMs: 4000,
        body: {
          model,
          input,
          parameters: {
            size,
            ...(data.duration ? { duration: data.duration } : {}),
            ...(data.seed != null ? { seed: data.seed } : {}),
          },
        },
      });
      videoUrl = (output.video_url as string | undefined) ?? "";
      coverUrl = (output.cover_image_url as string | undefined) ?? "";
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
        metadata: { mode, size, bytes, cover: coverUrl },
      });
    } catch { /* history is best-effort */ }

    if (data.projectId) {
      try {
        await context.supabase.from("projects").update({
          render_status: providerError ? "failed" : "completed",
          render_progress: providerError ? 0 : 100,
          video_provider: model,
          ...(providerError ? {} : { video_file: { url: storedUrl, provider: model, bytes, cover: coverUrl } }),
        }).eq("id", data.projectId);
      } catch { /* best-effort */ }
    }

    if (providerError) throw new Error(providerError);
    return { url: storedUrl, provider: model, mode, durationMs, bytes, cover: coverUrl };
  });
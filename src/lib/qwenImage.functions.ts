import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ASPECT_TO_SIZE: Record<string, string> = {
  "1:1": "1024*1024",
  "16:9": "1280*720",
  "9:16": "720*1280",
  "4:5": "1024*1280",
  portrait: "832*1216",
  landscape: "1216*832",
  ultra: "1440*1440",
};

const Input = z.object({
  prompt: z.string().min(1),
  negativePrompt: z.string().optional(),
  aspect: z.string().optional(),
  size: z.string().optional(),
  seed: z.number().int().optional(),
  n: z.number().int().min(1).max(4).optional(),
  model: z.enum(["wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "wan2.2-t2i-flash", "wan2.2-t2i-plus"]).optional(),
  projectId: z.string().optional(),
  sceneId: z.string().optional(),
});

export const generateQwenImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const { runAsyncTask, getBase, DEFAULT_DASHSCOPE_BASE } = await import("./dashscope.server");
    const model = data.model ?? "wanx2.1-t2i-turbo";
    const size = data.size || ASPECT_TO_SIZE[data.aspect ?? "16:9"] || "1280*720";
    const base = getBase("QWEN_BASE_URL", DEFAULT_DASHSCOPE_BASE);

    let url = "";
    let providerError: string | null = null;
    try {
      const output = await runAsyncTask({
        submitUrl: `${base}/api/v1/services/aigc/text2image/image-synthesis`,
        base,
        body: {
          model,
          input: { prompt: data.prompt, negative_prompt: data.negativePrompt },
          parameters: { size, n: data.n ?? 1, ...(data.seed != null ? { seed: data.seed } : {}) },
        },
      });
      const results = (output.results as Array<{ url?: string }> | undefined) ?? [];
      url = results[0]?.url ?? "";
      if (!url) throw new Error("DashScope returned no image URL.");
    } catch (e) {
      providerError = e instanceof Error ? e.message : String(e);
    }

    // Log to generation_history (server-side, RLS-safe via user JWT).
    const durationMs = Date.now() - t0;
    try {
      await context.supabase.from("generation_history").insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        asset_type: "generated_image",
        provider: model,
        status: providerError ? "failed" : "completed",
        duration_ms: durationMs,
        credits_used: providerError ? 0 : 1,
        error_message: providerError,
        metadata: { sceneId: data.sceneId ?? null, size, aspect: data.aspect ?? null },
      });
    } catch {
      // swallow: history is best-effort
    }

    if (providerError) throw new Error(providerError);

    // Persist to storage bucket under {userId}/images/{ts}-{scene}.png
    let storedUrl = url;
    try {
      const imgRes = await fetch(url);
      if (imgRes.ok) {
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        const name = `${context.userId}/images/${Date.now()}-${(data.sceneId ?? "scene").replace(/[^a-z0-9-]/gi, "").slice(0, 32)}.png`;
        const { data: up, error: upErr } = await context.supabase.storage
          .from("generated-media")
          .upload(name, bytes, { contentType: "image/png", upsert: false });
        if (!upErr && up) {
          const { data: signed } = await context.supabase.storage
            .from("generated-media")
            .createSignedUrl(up.path, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) storedUrl = signed.signedUrl;
        }
      }
    } catch {
      // Storage is best-effort; fall back to provider URL.
    }

    return { url: storedUrl, provider: model, durationMs, creditsUsed: 1 };
  });
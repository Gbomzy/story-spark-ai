import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  script: z.string().min(1),
  voice: z.string().optional(),
  model: z.enum(["cosyvoice-v1", "cosyvoice-v2", "qwen-tts", "qwen-tts-latest"]).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  pitch: z.number().min(0.5).max(2).optional(),
  volume: z.number().min(0).max(100).optional(),
  format: z.enum(["mp3", "wav"]).optional(),
  sampleRate: z.number().int().optional(),
  language: z.string().optional(),
  projectId: z.string().optional(),
});

export const generateCosyVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const { runAsyncTask, getBase, DEFAULT_DASHSCOPE_BASE } = await import("./dashscope.server");
    const model = data.model ?? "cosyvoice-v1";
    const voice = data.voice ?? (model.startsWith("qwen-tts") ? "Cherry" : "longxiaochun");
    const format = data.format ?? "mp3";
    const base = getBase("COSYVOICE_BASE_URL", DEFAULT_DASHSCOPE_BASE);

    let providerError: string | null = null;
    let audioUrl = "";
    let bytes = 0;

    try {
      const output = await runAsyncTask({
        submitUrl: `${base}/api/v1/services/audio/tts/`,
        base,
        body: {
          model,
          input: { text: data.script },
          parameters: {
            voice,
            format,
            ...(data.sampleRate ? { sample_rate: data.sampleRate } : {}),
            ...(data.speed != null ? { rate: data.speed } : {}),
            ...(data.pitch != null ? { pitch: data.pitch } : {}),
            ...(data.volume != null ? { volume: data.volume } : {}),
            ...(data.language ? { language: data.language } : {}),
          },
        },
      });
      const rawAudio = output.audio as { url?: string } | undefined;
      audioUrl = rawAudio?.url ?? "";
      if (!audioUrl) throw new Error("DashScope returned no audio URL.");
    } catch (e) {
      providerError = e instanceof Error ? e.message : String(e);
    }

    const durationMs = Date.now() - t0;

    // Persist to storage
    let storedUrl = audioUrl;
    if (audioUrl) {
      try {
        const audRes = await fetch(audioUrl);
        if (audRes.ok) {
          const buf = new Uint8Array(await audRes.arrayBuffer());
          bytes = buf.byteLength;
          const name = `${context.userId}/audio/${Date.now()}-${voice}.${format}`;
          const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
          const { data: up } = await context.supabase.storage
            .from("generated-media")
            .upload(name, buf, { contentType, upsert: false });
          if (up) {
            const { data: signed } = await context.supabase.storage
              .from("generated-media")
              .createSignedUrl(up.path, 60 * 60 * 24 * 7);
            if (signed?.signedUrl) storedUrl = signed.signedUrl;
          }
        }
      } catch {
        // best-effort
      }
    }

    try {
      await context.supabase.from("generation_history").insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        asset_type: "voice_audio",
        provider: model,
        status: providerError ? "failed" : "completed",
        duration_ms: durationMs,
        credits_used: providerError ? 0 : 1,
        error_message: providerError,
        metadata: { voice, format, bytes },
      });
    } catch {
      // history is best-effort
    }

    if (providerError) throw new Error(providerError);
    return { url: storedUrl, provider: model, voice, durationMs, bytes };
  });
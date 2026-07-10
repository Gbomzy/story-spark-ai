import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateQwenImage } from "@/lib/qwenImage.functions";
import { generateCosyVoice } from "@/lib/cosyvoice.functions";
import { generateWanVideo } from "@/lib/wanVideo.functions";

const Input = z.object({ projectId: z.string() });

type Stage = "generated_images" | "narration" | "video";
type StageState = "pending" | "generating" | "completed" | "failed";

/** Run the media portion of the pipeline for a project (images → voice → video). */
export const runFullMoviePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { data: proj, error } = await context.supabase
      .from("projects")
      .select("id,name,story,voice,images,generated_images,voice_audio,video_file,media_pipeline")
      .eq("id", data.projectId)
      .single();
    if (error || !proj) throw new Error(error?.message ?? "Project not found.");

    const pipeline: Record<string, StageState> =
      (proj.media_pipeline as Record<string, StageState> | null) ?? {};
    const setStage = async (stage: Stage, state: StageState, patch: Record<string, unknown> = {}) => {
      pipeline[stage] = state;
      await context.supabase.from("projects").update({ media_pipeline: pipeline, ...patch }).eq("id", proj.id);
    };

    const scenes = parseScenes(proj.images);
    const results: Record<string, unknown> = {};

    // 1. Images
    if (scenes.length > 0) {
      await setStage("generated_images", "generating");
      const images: Array<{ id: string; url: string }> = [];
      try {
        for (const scene of scenes) {
          const r = await generateQwenImage({
            data: { prompt: scene.prompt, projectId: proj.id, sceneId: scene.id, aspect: "16:9" },
          });
          images.push({ id: scene.id, url: r.url });
        }
        await setStage("generated_images", "completed", { generated_images: images });
        results.images = images;
      } catch (e) {
        await setStage("generated_images", "failed");
        throw e;
      }
    }

    // 2. Narration
    const voiceScript = extractText(proj.voice);
    if (voiceScript) {
      await setStage("narration", "generating");
      try {
        const v = await generateCosyVoice({ data: { script: voiceScript, projectId: proj.id } });
        await setStage("narration", "completed", { voice_audio: { url: v.url, provider: v.provider, bytes: v.bytes } });
        results.voice = v;
      } catch (e) {
        await setStage("narration", "failed");
        throw e;
      }
    }

    // 3. Video (text-to-video from story summary)
    const videoPrompt = summarize(proj.story) || proj.name || "Cinematic short film";
    await setStage("video", "generating");
    try {
      const v = await generateWanVideo({ data: { prompt: videoPrompt, projectId: proj.id, mode: "t2v", duration: 5 } });
      pipeline.video = "completed";
      results.video = v;
    } catch (e) {
      await setStage("video", "failed");
      throw e;
    }

    return { ok: true, results };
  });

function parseScenes(images: unknown): Array<{ id: string; prompt: string }> {
  if (!images) return [];
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: unknown, i: number) => {
        const o = (s ?? {}) as Record<string, unknown>;
        const prompt = String(o.prompt ?? o.description ?? o.text ?? "").trim();
        const id = String(o.id ?? `scene-${i + 1}`);
        return prompt ? { id, prompt } : null;
      })
      .filter(Boolean) as Array<{ id: string; prompt: string }>;
  } catch {
    return [];
  }
}

function extractText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.text ?? o.script ?? o.content ?? "");
  }
  return "";
}

function summarize(v: unknown): string {
  const text = extractText(v);
  return text.slice(0, 800);
}
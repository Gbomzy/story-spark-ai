import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateQwenImage } from "@/lib/qwenImage.functions";
import { generateCosyVoice } from "@/lib/cosyvoice.functions";
import { generateWanVideo } from "@/lib/wanVideo.functions";

const Input = z.object({
  projectId: z.string(),
  perSceneDuration: z.number().int().min(2).max(10).optional(),
  chainScenes: z.boolean().optional(),
  wordsPerSecond: z.number().min(1).max(6).optional(),
  maxClipSeconds: z.number().int().min(2).max(10).optional(),
});

type Stage = "generated_images" | "narration" | "video";
type StageState = "pending" | "generating" | "completed" | "failed";

export type SceneClip = {
  sceneNumber: number;
  clipNumber: number;
  sceneId: string;
  prompt: string;
  url: string;
  cover?: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  provider: string;
  model?: string;
  trimStart?: number;
  trimEnd?: number;
};

export type MovieManifest = {
  kind: "chained" | "single";
  url: string; // first clip (or single clip) — keeps existing UI working
  clips: SceneClip[];
  narrationUrl?: string;
  subtitleUrl?: string;
  provider: string;
  totalDurationSeconds: number;
  wordsPerSecond?: number;
  maxClipSeconds?: number;
  transition?: "cut" | "fade" | "crossfade" | "slide" | "dissolve";
  transitionDuration?: number;
  resolution?: "720p" | "1080p";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:5";
  fps?: number;
  quality?: "standard" | "high" | "ultra";
};

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
    const perScene = data.perSceneDuration ?? 5;
    const wps = data.wordsPerSecond ?? 2.5; // ~150 wpm narration pace
    const maxClip = data.maxClipSeconds ?? 10; // Wan hard limit
    const chain = data.chainScenes !== false; // default: chain
    const results: {
      images?: Array<{ id: string; url: string }>;
      voiceUrl?: string;
      videoUrl?: string;
      clips?: SceneClip[];
    } = {};

    // 1. Images
    if (scenes.length > 0 && pipeline.generated_images !== "completed") {
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
    if (voiceScript && pipeline.narration !== "completed") {
      await setStage("narration", "generating");
      try {
        const v = await generateCosyVoice({ data: { script: voiceScript, projectId: proj.id } });
        await setStage("narration", "completed", { voice_audio: { url: v.url, provider: v.provider, bytes: v.bytes } });
        results.voiceUrl = v.url;
      } catch (e) {
        await setStage("narration", "failed");
        throw e;
      }
    }

    // 3. Video — either one clip per scene (chained movie) or a single Wan clip.
    if (pipeline.video === "completed") return { ok: true, results, resumed: true };
    await setStage("video", "generating");
    try {
      const clips: SceneClip[] = [];
      let providerLabel = "wan";
      if (chain && scenes.length > 0) {
        // Split narration text across scenes evenly (respecting per-scene narration if present).
        const perSceneWords = splitWordsAcrossScenes(voiceScript, scenes);
        let cursor = 0;
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          const words = scene.narrationWords ?? perSceneWords[i] ?? 0;
          const estimated = Math.max(perScene, Math.ceil(words / wps));
          const segments = segmentDuration(estimated, maxClip);
          for (let j = 0; j < segments.length; j++) {
            const dur = segments[j];
            const promptText = segments.length > 1
              ? `${scene.prompt} — continuous shot, part ${j + 1} of ${segments.length}`
              : scene.prompt;
            const r = await generateWanVideo({
              data: { prompt: promptText, projectId: proj.id, mode: "t2v", duration: dur },
            });
            providerLabel = r.provider;
            clips.push({
              sceneNumber: i + 1,
              clipNumber: j + 1,
              sceneId: scene.id,
              prompt: promptText,
              url: r.url,
              cover: r.cover,
              startTime: cursor,
              endTime: cursor + dur,
              durationSeconds: dur,
              provider: r.provider,
            });
            cursor += dur;
          }
        }
      } else {
        const videoPrompt = summarize(proj.story) || proj.name || "Cinematic short film";
        const r = await generateWanVideo({
          data: { prompt: videoPrompt, projectId: proj.id, mode: "t2v", duration: perScene },
        });
        providerLabel = r.provider;
        clips.push({
          sceneNumber: 1,
          clipNumber: 1,
          sceneId: "main",
          prompt: videoPrompt,
          url: r.url,
          cover: r.cover,
          startTime: 0,
          endTime: perScene,
          durationSeconds: perScene,
          provider: r.provider,
        });
      }

      const manifest: MovieManifest = {
        kind: clips.length > 1 ? "chained" : "single",
        url: clips[0]?.url ?? "",
        clips,
        narrationUrl: results.voiceUrl,
        provider: providerLabel,
        totalDurationSeconds: clips.reduce((sum, c) => sum + c.durationSeconds, 0),
        wordsPerSecond: wps,
        maxClipSeconds: maxClip,
      };

      pipeline.video = "completed";
      await context.supabase
        .from("projects")
        .update({ media_pipeline: pipeline, video_file: manifest, render_status: "completed", render_progress: 100, video_provider: providerLabel })
        .eq("id", proj.id);
      results.clips = clips;
      results.videoUrl = manifest.url;
    } catch (e) {
      await setStage("video", "failed");
      throw e;
    }

    return { ok: true, results };
  });

function parseScenes(images: unknown): Array<{ id: string; prompt: string; narrationWords?: number }> {
  if (!images) return [];
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: unknown, i: number) => {
        const o = (s ?? {}) as Record<string, unknown>;
        const prompt = String(o.prompt ?? o.description ?? o.text ?? "").trim();
        const id = String(o.id ?? `scene-${i + 1}`);
        const narration = String(o.narration ?? o.voiceover ?? o.script ?? "").trim();
        const narrationWords = narration ? narration.split(/\s+/).filter(Boolean).length : undefined;
        return prompt ? { id, prompt, narrationWords } : null;
      })
      .filter(Boolean) as Array<{ id: string; prompt: string; narrationWords?: number }>;
  } catch {
    return [];
  }
}

function splitWordsAcrossScenes(script: string, scenes: Array<{ narrationWords?: number }>): number[] {
  if (!script || scenes.length === 0) return scenes.map(() => 0);
  const words = script.split(/\s+/).filter(Boolean).length;
  const per = Math.ceil(words / scenes.length);
  return scenes.map(() => per);
}

function segmentDuration(totalSeconds: number, maxClip: number): number[] {
  if (totalSeconds <= maxClip) return [Math.max(2, totalSeconds)];
  const out: number[] = [];
  let remaining = totalSeconds;
  while (remaining > 0) {
    const take = Math.min(maxClip, remaining);
    // avoid a tiny <2s tail — merge into previous
    if (take < 2 && out.length > 0) { out[out.length - 1] += take; break; }
    out.push(take);
    remaining -= take;
  }
  return out;
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
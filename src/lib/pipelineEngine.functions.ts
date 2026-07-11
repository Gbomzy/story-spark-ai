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
  maxClipsPerCall: z.number().int().min(1).max(4).optional(),
  characterName: z.string().max(80).optional(),
  characterDescription: z.string().max(600).optional(),
  size: z.string().max(20).optional(),
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
  burnSubtitles?: boolean;
  subtitlePosition?: "bottom" | "middle" | "top";
};

/** Run the media portion of the pipeline for a project (images → voice → video). */
export const runFullMoviePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { data: proj, error } = await context.supabase
      .from("projects")
      .select("id,name,story,voice,images,storyboard,generated_images,voice_audio,video_file,media_pipeline")
      .eq("id", data.projectId)
      .single();
    if (error || !proj) throw new Error(error?.message ?? "Project not found.");

    const pipeline: Record<string, StageState> =
      (proj.media_pipeline as Record<string, StageState> | null) ?? {};
    const setStage = async (stage: Stage, state: StageState, patch: Record<string, unknown> = {}) => {
      pipeline[stage] = state;
      await context.supabase.from("projects").update({ media_pipeline: pipeline, ...patch }).eq("id", proj.id);
    };

    let scenes = parseScenes(proj.images);
    if (scenes.length === 0 && typeof proj.storyboard === "string" && proj.storyboard.trim()) {
      scenes = parseStoryboardText(proj.storyboard);
    }
    const perScene = data.perSceneDuration ?? 5;
    const wps = data.wordsPerSecond ?? 2.5; // ~150 wpm narration pace
    const maxClip = data.maxClipSeconds ?? 10; // Wan hard limit
    const chain = data.chainScenes !== false; // default: chain
    const maxClipsPerCall = data.maxClipsPerCall ?? 1; // process one Wan clip per invocation to avoid Worker timeouts
    const characterName = (data.characterName ?? "").trim();
    const characterDesc = (data.characterDescription ?? "").trim();
    const characterPrefix = characterDesc
      ? `Featuring ${characterDesc} Keep the character's appearance identical to this description in every shot. `
      : "";
    const characterSeedValue = characterName ? fnv1a(characterName) : undefined;
    const results: {
      images?: Array<{ id: string; url: string }>;
      voiceUrl?: string;
      videoUrl?: string;
      clips?: SceneClip[];
      queueTotal?: number;
      queueCompleted?: number;
      queueRemaining?: number;
      done?: boolean;
    } = {};

    // 1. Images
    if (scenes.length > 0 && pipeline.generated_images !== "completed") {
      await setStage("generated_images", "generating");
      const images: Array<{ id: string; url: string }> = [];
      try {
        for (const scene of scenes) {
          const r = await generateQwenImage({
            data: {
              prompt: `${characterPrefix}${scene.prompt}`,
              projectId: proj.id,
              sceneId: scene.id,
              aspect: "16:9",
              ...(characterSeedValue != null ? { seed: characterSeedValue } : {}),
            },
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
    const { sanitizeVoiceScript } = await import("./voiceScript");
    const voiceScript = sanitizeVoiceScript(extractText(proj.voice));
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

    // 3. Video — build a persistent clip queue, then generate one (or a small
    // batch) of pending clips per invocation so we never hit the Worker
    // timeout. The manifest is written to `video_file` up-front with pending
    // clips (empty url), and each successful Wan generation is appended in
    // place. The client keeps calling this fn until `done === true`.

    let manifest = (proj.video_file as MovieManifest | null) ?? null;
    const looksLikeQueue = manifest && Array.isArray(manifest.clips) && manifest.clips.length > 0
      && manifest.clips.every((c) => typeof c?.prompt === "string");
    // If the storyboard has more scenes than the persisted manifest covers,
    // the previous run was built before the storyboard existed (single-shot
    // fallback). Rebuild the queue so every scene gets a clip.
    const manifestSceneCount = manifest && Array.isArray(manifest.clips)
      ? new Set(manifest.clips.map((c) => c.sceneNumber)).size
      : 0;
    const staleQueue = looksLikeQueue && chain && scenes.length > manifestSceneCount;
    if (staleQueue) {
      manifest = null;
    }

    if (!looksLikeQueue || staleQueue) {
      // Build the full queue from storyboard scenes (or a single-shot fallback).
      const queued: SceneClip[] = [];
      if (chain && scenes.length > 0) {
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
            queued.push({
              sceneNumber: i + 1,
              clipNumber: j + 1,
              sceneId: scene.id,
              prompt: `${characterPrefix}${promptText}`,
              url: "", // pending
              startTime: cursor,
              endTime: cursor + dur,
              durationSeconds: dur,
              provider: "wan",
            });
            cursor += dur;
          }
        }
      } else {
        const videoPrompt = summarize(proj.story) || proj.name || "Cinematic short film";
        queued.push({
          sceneNumber: 1,
          clipNumber: 1,
          sceneId: "main",
          prompt: videoPrompt,
          url: "",
          startTime: 0,
          endTime: perScene,
          durationSeconds: perScene,
          provider: "wan",
        });
      }

      manifest = {
        kind: queued.length > 1 ? "chained" : "single",
        url: "",
        clips: queued,
        narrationUrl: results.voiceUrl ?? extractUrl(proj.voice_audio),
        provider: "wan",
        totalDurationSeconds: queued.reduce((n, c) => n + c.durationSeconds, 0),
        wordsPerSecond: wps,
        maxClipSeconds: maxClip,
      };

      pipeline.video = "generating";
      await context.supabase
        .from("projects")
        .update({
          media_pipeline: pipeline,
          video_file: manifest,
          render_status: "generating",
          render_progress: 1,
        })
        .eq("id", proj.id);
      console.log(`[pipeline] scenes=${scenes.length} clips_queued=${queued.length}`);
    }

    if (!manifest) throw new Error("Failed to build clip queue.");

    const total = manifest.clips.length;
    const isPending = (c: SceneClip) => !c.url || c.url.length === 0;
    const pendingIdxs = manifest.clips.map((c, i) => (isPending(c) ? i : -1)).filter((i) => i >= 0);
    console.log(`[pipeline] total=${total} pending=${pendingIdxs.length} completed=${total - pendingIdxs.length}`);

    if (pendingIdxs.length === 0) {
      // Everything already generated — mark done.
      pipeline.video = "completed";
      manifest.url = manifest.clips[0]?.url ?? manifest.url;
      manifest.totalDurationSeconds = manifest.clips.reduce((n, c) => n + c.durationSeconds, 0);
      await context.supabase
        .from("projects")
        .update({
          media_pipeline: pipeline,
          video_file: manifest,
          render_status: "completed",
          render_progress: 100,
        })
        .eq("id", proj.id);
      results.clips = manifest.clips;
      results.videoUrl = manifest.url;
      results.queueTotal = total;
      results.queueCompleted = total;
      results.queueRemaining = 0;
      results.done = true;
      return { ok: true, results };
    }

    // Generate up to `maxClipsPerCall` pending clips this invocation.
    if (pipeline.video !== "generating") {
      await setStage("video", "generating");
    }
    let submitted = 0;
    let providerLabel = manifest.provider ?? "wan";
    try {
      for (const idx of pendingIdxs.slice(0, maxClipsPerCall)) {
        const target = manifest.clips[idx];
        const dur = Math.max(2, Math.min(maxClip, Math.round(target.durationSeconds)));
        const r = await generateWanVideo({
          data: {
            prompt: target.prompt,
            projectId: proj.id,
            mode: "t2v",
            duration: dur,
            skipProjectVideoUpdate: true, // don't clobber our manifest
            ...(data.size ? { size: data.size } : {}),
          },
        });
        providerLabel = r.provider;
        manifest.clips[idx] = {
          ...target,
          url: r.url,
          cover: r.cover,
          durationSeconds: dur,
          provider: r.provider,
        };
        submitted++;

        // Persist after every successful clip → resume-safe.
        const completedNow = manifest.clips.filter((c) => !isPending(c)).length;
        const progressPct = Math.max(1, Math.min(99, Math.round((completedNow / total) * 100)));
        manifest.url = manifest.clips.find((c) => !isPending(c))?.url ?? manifest.url;
        manifest.provider = providerLabel;
        await context.supabase
          .from("projects")
          .update({
            video_file: manifest,
            render_status: "generating",
            render_progress: progressPct,
            video_provider: providerLabel,
          })
          .eq("id", proj.id);
        console.log(`[pipeline] wrote clip ${completedNow}/${total} scene=${target.sceneNumber} part=${target.clipNumber}`);
      }
    } catch (e) {
      // Persist whatever we managed so the next call resumes.
      await context.supabase
        .from("projects")
        .update({ media_pipeline: pipeline, video_file: manifest, render_status: "failed" })
        .eq("id", proj.id);
      throw e;
    }

    const completed = manifest.clips.filter((c) => !isPending(c)).length;
    const remaining = total - completed;
    const done = remaining === 0;
    if (done) {
      pipeline.video = "completed";
      manifest.url = manifest.clips[0]?.url ?? manifest.url;
      manifest.totalDurationSeconds = manifest.clips.reduce((n, c) => n + c.durationSeconds, 0);
      await context.supabase
        .from("projects")
        .update({
          media_pipeline: pipeline,
          video_file: manifest,
          render_status: "completed",
          render_progress: 100,
          video_provider: providerLabel,
        })
        .eq("id", proj.id);
    }
    console.log(`[pipeline] submitted=${submitted} completed=${completed}/${total} done=${done}`);

    results.clips = manifest.clips;
    results.videoUrl = manifest.url;
    results.queueTotal = total;
    results.queueCompleted = completed;
    results.queueRemaining = remaining;
    results.done = done;
    return { ok: true, results };
  });

function extractUrl(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
  }
  return undefined;
}

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
  return _splitWords(script, scenes);
}

function _splitWords(script: string, scenes: Array<{ narrationWords?: number }>): number[] {
  if (!script || scenes.length === 0) return scenes.map(() => 0);
  const words = script.split(/\s+/).filter(Boolean).length;
  const per = Math.ceil(words / scenes.length);
  return scenes.map(() => per);
}

/** Parse the plain-text storyboard column into scene entries. Mirrors the
 *  parser used on the Storyboard page: split on blank lines, first line = title. */
function parseStoryboardText(text: string): Array<{ id: string; prompt: string; narrationWords?: number }> {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.slice(0, 40).map((block, i) => {
    const firstLine = block.split("\n")[0].trim();
    const rest = block.split("\n").slice(1).join("\n").trim();
    const title = firstLine.replace(/^#+\s*/, "").slice(0, 120) || `Scene ${i + 1}`;
    const prompt = `${title}. ${rest || firstLine}`.slice(0, 1200);
    return { id: `scene-${i + 1}`, prompt };
  });
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

/** Strip TTS-unfriendly artifacts from narration text:
 *  - "Narrator:" / "NARRATOR:" prefixes
 *  - Character label prefixes ("Lila: hello") → keep just the spoken words
 *  - Stage directions in [brackets] or (parentheses)
 *  - Markdown headings and bullet markers
 *  So the TTS reads the actual story, not the script scaffolding. */
export function sanitizeNarration(raw: string): string {
  if (!raw) return "";
  const lines = raw.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    let l = line.trim();
    if (!l) { cleaned.push(""); continue; }
    // strip markdown headings / bullets
    l = l.replace(/^#{1,6}\s+/, "").replace(/^[-*•]\s+/, "");
    // drop scene / shot headings entirely
    if (/^(scene|shot|act|chapter|part|int\.|ext\.)\s*\d*[:.\-]/i.test(l)) continue;
    // strip a leading "Narrator:" prefix
    l = l.replace(/^\s*narrator\s*[:\-]\s*/i, "");
    // drop lines that were ONLY a narrator label
    if (!l) continue;
    // strip a leading "Name:" character label (e.g. "Lila: Hello!")
    l = l.replace(/^\s*[A-Z][A-Za-z' .-]{0,30}\s*:\s+/, "");
    // strip stage directions in [] or ()
    l = l.replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, "");
    l = l.replace(/\s{2,}/g, " ").trim();
    if (l) cleaned.push(l);
  }
  return cleaned.join(" ").replace(/\s+/g, " ").trim();
}

/** FNV-1a 32-bit hash for deterministic per-character seeds. */
function fnv1a(s: string): number {
  let h = 2166136261 >>> 0;
  const q = s.trim().toLowerCase();
  for (let i = 0; i < q.length; i++) {
    h ^= q.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 2147483647;
}
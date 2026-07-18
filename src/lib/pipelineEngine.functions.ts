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
  /** Low-Cost Test Mode — cap scenes to 2-3 so a full render costs a
   *  fraction of a normal one. Additive: default off. */
  testMode: z.boolean().optional(),
  maxScenes: z.number().int().min(1).max(40).optional(),
  /** Regenerate only one scene (1-based). Skips images/narration stages
   *  and only re-queues the target clip inside an existing manifest. */
  regenerateSceneOnly: z.number().int().min(1).max(60).optional(),
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
  status?: ClipStatus;
  progress?: number;
  retryCount?: number;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  error?: string | null;
};

export type ClipStatus =
  | "pending"
  | "queued"
  | "starting"
  | "uploading"
  | "rendering"
  | "processing"
  | "saving"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused"
  | "retrying"
  | "stalled";

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
      .select("id,name,story,voice,images,storyboard,generated_images,voice_audio,video_file,media_pipeline,render_control,story_bible")
      .eq("id", data.projectId)
      .single();
    if (error || !proj) throw new Error(error?.message ?? "Project not found.");

    // Honor control signals (pause/cancel) from the Render Dashboard.
    const control = (proj as { render_control?: string | null }).render_control ?? null;
    const controlResult = {
      queueTotal: 0,
      queueCompleted: 0,
      queueRemaining: 0,
      clips: [] as SceneClip[],
      done: false,
      cancelled: false,
      paused: false,
    };
    if (control === "cancel") {
      await context.supabase.from("projects").update({
        render_status: "cancelled",
        render_control: null,
        render_error: "Cancelled by user",
      }).eq("id", proj.id);
      return { ok: true, results: { ...controlResult, done: true, cancelled: true } };
    }
    if (control === "pause") {
      await context.supabase.from("projects").update({
        render_status: "paused",
        render_heartbeat: new Date().toISOString(),
      }).eq("id", proj.id);
      return { ok: true, results: { ...controlResult, paused: true } };
    }

    const pipeline: Record<string, StageState> =
      (proj.media_pipeline as Record<string, StageState> | null) ?? {};
    const setStage = async (stage: Stage, state: StageState, patch: Record<string, unknown> = {}) => {
      pipeline[stage] = state;
      await context.supabase.from("projects").update({ media_pipeline: pipeline, ...patch }).eq("id", proj.id);
    };

    // Prefer the Scene Plan as the single source of truth. When a plan
    // exists on story_bible, derive scenes, video prompts and narration
    // durations from it — no downstream stage is allowed to invent scene
    // content. Fall back to the legacy storyboard/images columns only if
    // the plan is missing (older projects).
    const { readScenePlanFromBible } = await import("./scenePlan.functions");
    const scenePlan = readScenePlanFromBible((proj as { story_bible?: unknown }).story_bible);
    let scenes: Array<{ id: string; prompt: string; narrationWords?: number; videoPrompt?: string; plannedDuration?: number }> = [];
    if (scenePlan) {
      const { scenePlanToImagesJson, scenePlanToVoiceScript } = await import("./scenePlan");
      const rows = scenePlanToImagesJson(scenePlan);
      scenes = rows.map((r) => ({
        id: r.id,
        prompt: r.prompt,
        videoPrompt: r.videoPrompt,
        narrationWords: r.narration ? r.narration.split(/\s+/).filter(Boolean).length : undefined,
        plannedDuration: r.durationSeconds,
      }));
      // Keep the persisted narration script in sync with the plan.
      const derivedScript = scenePlanToVoiceScript(scenePlan);
      if (derivedScript && typeof proj.voice === "string" && !proj.voice.includes("[NARRATOR]")) {
        (proj as { voice?: unknown }).voice = derivedScript;
      }
    }
    if (scenes.length === 0) {
      scenes = parseScenes(proj.images);
    }
    if (scenes.length === 0 && typeof proj.storyboard === "string" && proj.storyboard.trim()) {
      scenes = parseStoryboardText(proj.storyboard);
    }
    const perScene = data.perSceneDuration ?? 5;
    const wps = data.wordsPerSecond ?? 2.5; // ~150 wpm narration pace
    const maxClip = data.maxClipSeconds ?? 10; // Wan hard limit
    const chain = data.chainScenes !== false; // default: chain
    const maxClipsPerCall = data.maxClipsPerCall ?? 1; // process one Wan clip per invocation to avoid Worker timeouts
    const testMode = data.testMode === true;
    const maxScenes = data.maxScenes ?? (testMode ? 3 : undefined);
    const regenerateSceneOnly = data.regenerateSceneOnly ?? null;
    // Test Mode / explicit cap: shrink the scene list BEFORE building
    // any clip queue so we never spend credits on scenes we'll throw away.
    if (typeof maxScenes === "number" && scenes.length > maxScenes) {
      scenes = scenes.slice(0, maxScenes);
    }
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

    // 1. Images — enrich every scene prompt with cinematic direction so
    // the resulting frames are premium children's animation quality
    // (consistent characters, cinematic lighting, expressive faces).
    // In regenerate-scene-only mode we skip this stage entirely.
    if (scenes.length > 0 && pipeline.generated_images !== "completed" && regenerateSceneOnly == null) {
      await setStage("generated_images", "generating");
      const images: Array<{ id: string; url: string }> = [];
      try {
        const { buildShotPlan, enrichImagePrompt } = await import("./cinematicDirector");
        let prevShotImg: import("./cinematicDirector").CameraShot | undefined;
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          const planImg = buildShotPlan({
            sceneId: scene.id,
            sceneNumber: i + 1,
            total: scenes.length,
            text: scene.prompt,
            prevShot: prevShotImg,
          });
          prevShotImg = planImg.cameraShot;
          const enriched = enrichImagePrompt(`${characterPrefix}${scene.prompt}`, planImg);
          const r = await generateQwenImage({
            data: {
              prompt: enriched,
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

    // 2. Narration — the AI Storyteller layer picks expressive voice
    // parameters (voice preset, speed, pitch) based on the narration's
    // emotion + BGM mood before we hit the TTS provider.
    const { sanitizeVoiceScript, expressiveVoiceScript } = await import("./voiceScript");
    const cleanScript = sanitizeVoiceScript(extractText(proj.voice));
    const voiceScript = expressiveVoiceScript(cleanScript);
    if (voiceScript && pipeline.narration !== "completed" && regenerateSceneOnly == null) {
      await setStage("narration", "generating");
      try {
        const { planStoryteller } = await import("./storyteller");
        const plan = planStoryteller(voiceScript);
        const v = await generateCosyVoice({
          data: {
            script: voiceScript,
            projectId: proj.id,
            voice: plan.params.voice,
            speed: plan.params.speed,
            pitch: plan.params.pitch,
          },
        });
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

    // Regenerate-scene-only: reset a specific clip's status/url so the
    // pending loop below picks it up again. No new queue is built.
    if (regenerateSceneOnly != null && manifest && Array.isArray(manifest.clips)) {
      for (const c of manifest.clips) {
        if (c.sceneNumber === regenerateSceneOnly) {
          c.url = "";
          c.status = "pending";
          c.error = null;
          c.retryCount = 0;
        }
      }
      await context.supabase.from("projects").update({
        video_file: manifest,
        render_status: "generating",
        render_error: null,
        render_heartbeat: new Date().toISOString(),
      }).eq("id", proj.id);
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

      // Enrich every queued clip prompt with cinematic direction, motion,
      // and quality tags so downstream Wan calls receive a production-grade prompt.
      try {
        const { buildShotPlan, enrichVideoPrompt } = await import("./cinematicDirector");
        const total = queued.length;
        let prevShot: import("./cinematicDirector").CameraShot | undefined;
        for (let i = 0; i < queued.length; i++) {
          const c = queued[i];
          const plan = buildShotPlan({
            sceneId: c.sceneId,
            sceneNumber: c.sceneNumber,
            total,
            text: c.prompt,
            prevShot,
          });
          prevShot = plan.cameraShot;
          c.prompt = enrichVideoPrompt(c.prompt, plan);
        }
      } catch (err) {
        console.warn("[pipeline] cinematic enrichment skipped", err);
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

      // Pre-render Quality Gate: aborts BEFORE spending Wan credits if
      // prompts are empty/duplicate/oversized or the narration still
      // contains stage directions.
      try {
        const { validateRenderInputs, formatIssues } = await import("./qualityValidator");
        const report = validateRenderInputs({
          clips: queued,
          narration: cleanScript,
          maxClipSeconds: maxClip,
        });
        if (!report.ok) {
          const msg = `Quality validation failed:\n${formatIssues(report)}`;
          await context.supabase.from("projects").update({
            render_status: "failed",
            render_error: msg,
          }).eq("id", proj.id);
          throw new Error(`Render aborted — ${msg}`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Render aborted")) throw err;
        console.warn("[pipeline] quality validator skipped", err);
      }

      pipeline.video = "generating";
      await context.supabase
        .from("projects")
        .update({
          media_pipeline: pipeline,
          video_file: manifest,
          render_status: "generating",
          render_progress: 1,
          render_started_at: new Date().toISOString(),
          render_heartbeat: new Date().toISOString(),
          render_error: null,
        })
        .eq("id", proj.id);
      console.log(`[pipeline] scenes=${scenes.length} clips_queued=${queued.length}`);
    }

    if (!manifest) throw new Error("Failed to build clip queue.");

    const total = manifest.clips.length;
    const isPending = (c: SceneClip) =>
      (!c.url || c.url.length === 0) && c.status !== "failed" && c.status !== "cancelled";
    // Ensure every clip has a status set (defaults for legacy manifests).
    for (const c of manifest.clips) {
      if (!c.status) c.status = c.url ? "completed" : "pending";
      if (typeof c.retryCount !== "number") c.retryCount = 0;
    }
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
    const heartbeat = async (patch: Record<string, unknown> = {}) => {
      await context.supabase.from("projects").update({
        render_heartbeat: new Date().toISOString(),
        ...patch,
      }).eq("id", proj.id);
    };
    for (const idx of pendingIdxs.slice(0, maxClipsPerCall)) {
      const target = manifest.clips[idx];
      const dur = Math.max(2, Math.min(maxClip, Math.round(target.durationSeconds)));
      const now = () => new Date().toISOString();
      const writeClip = async (patch: Partial<SceneClip>, projPatch: Record<string, unknown> = {}) => {
        manifest!.clips[idx] = { ...manifest!.clips[idx], ...patch, updatedAt: now() };
        const completedNow = manifest!.clips.filter((c) => c.status === "completed").length;
        const progressPct = Math.max(1, Math.min(99, Math.round((completedNow / total) * 100)));
        await context.supabase.from("projects").update({
          video_file: manifest,
          render_progress: progressPct,
          render_heartbeat: new Date().toISOString(),
          ...projPatch,
        }).eq("id", proj.id);
      };

      await writeClip({ status: "starting", startedAt: now(), error: null }, {
        render_status: "generating",
      });

      const MAX_RETRIES = 3;
      let lastErr: string | null = null;
      let success = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await writeClip({ status: attempt === 1 ? "rendering" : "retrying", retryCount: attempt - 1 });
          const r = await generateWanVideo({
            data: {
              prompt: target.prompt,
              projectId: proj.id,
              mode: "t2v",
              duration: dur,
              skipProjectVideoUpdate: true,
              ...(data.size ? { size: data.size } : {}),
            },
          });
          providerLabel = r.provider;
          await writeClip({
            status: "completed",
            url: r.url,
            cover: r.cover,
            durationSeconds: dur,
            provider: r.provider,
            progress: 100,
            completedAt: now(),
            error: null,
          }, { video_provider: providerLabel });
          console.log(`[pipeline] clip scene=${target.sceneNumber} part=${target.clipNumber} completed (attempt ${attempt})`);
          success = true;
          submitted++;
          break;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
          console.warn(`[pipeline] clip attempt ${attempt} failed: ${lastErr}`);
          if (attempt < MAX_RETRIES) {
            await writeClip({ status: "retrying", retryCount: attempt, error: lastErr });
            await new Promise((res) => setTimeout(res, 1500 * attempt));
          }
        }
      }
      if (!success) {
        // Mark THIS clip failed but continue with remaining clips.
        await writeClip({ status: "failed", error: lastErr, retryCount: MAX_RETRIES }, {
          render_error: lastErr,
        });
        await heartbeat();
        // continue to next pending idx
      }
    }

    const completed = manifest.clips.filter((c) => c.status === "completed").length;
    const failed = manifest.clips.filter((c) => c.status === "failed").length;
    const remaining = total - completed - failed;
    const done = remaining === 0;
    if (done) {
      pipeline.video = failed > 0 && completed === 0 ? "failed" : "completed";
      manifest.url = manifest.clips.find((c) => c.url)?.url ?? manifest.url;
      manifest.totalDurationSeconds = manifest.clips.reduce((n, c) => n + c.durationSeconds, 0);
      await context.supabase
        .from("projects")
        .update({
          media_pipeline: pipeline,
          video_file: manifest,
          render_status: failed > 0 ? (completed > 0 ? "partial" : "failed") : "completed",
          render_progress: 100,
          render_heartbeat: new Date().toISOString(),
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
 *  parser used on the Storyboard page. Robust to storyboards that ship
 *  without blank-line separators between scenes: we ALSO split on scene
 *  headings ("## Scene 1", "Scene 1:", "1.") so the pipeline never
 *  collapses a 13-scene storyboard into a single 1-clip render. */
function parseStoryboardText(text: string): Array<{ id: string; prompt: string; narrationWords?: number }> {
  const raw = text.replace(/\r\n/g, "\n");
  let blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  // If double-newline splitting yields fewer than 2 blocks, or if the very
  // first block already contains multiple embedded scene headings, fall back
  // to splitting on scene-heading boundaries so a run-on storyboard still
  // produces one entry per scene.
  const headingRe = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:Scene|SCENE|scene)\s+\d+\b/g;
  const headingHits = (raw.match(headingRe) ?? []).length;
  if (headingHits >= 2 && (blocks.length < headingHits)) {
    // Split on positions that begin with a Scene N heading. Keep the
    // heading with its block by using a lookahead.
    blocks = raw
      .split(/(?=(?:^|\n)\s*(?:#{1,6}\s*)?(?:Scene|SCENE|scene)\s+\d+\b)/)
      .map((b) => b.trim())
      .filter(Boolean);
  }
  // Numbered fallback: "1. …\n2. …" without blank lines.
  if (blocks.length < 2) {
    const numHits = raw.match(/(?:^|\n)\s*\d{1,2}[.)]\s+/g) ?? [];
    if (numHits.length >= 2) {
      blocks = raw
        .split(/(?=(?:^|\n)\s*\d{1,2}[.)]\s+)/)
        .map((b) => b.trim())
        .filter(Boolean);
    }
  }
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
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWanVideo } from "@/lib/wanVideo.functions";
import type { MovieManifest, SceneClip } from "@/lib/pipelineEngine.functions";

const ClipSchema = z.object({
  sceneNumber: z.number(),
  clipNumber: z.number(),
  sceneId: z.string(),
  prompt: z.string(),
  url: z.string(),
  cover: z.string().optional(),
  startTime: z.number(),
  endTime: z.number(),
  durationSeconds: z.number(),
  provider: z.string(),
  model: z.string().optional(),
  trimStart: z.number().optional(),
  trimEnd: z.number().optional(),
});

const ManifestSchema = z.object({
  kind: z.enum(["chained", "single"]),
  url: z.string(),
  clips: z.array(ClipSchema),
  narrationUrl: z.string().optional(),
  subtitleUrl: z.string().optional(),
  provider: z.string(),
  totalDurationSeconds: z.number(),
  wordsPerSecond: z.number().optional(),
  maxClipSeconds: z.number().optional(),
  transition: z.enum(["cut", "fade", "crossfade", "slide", "dissolve"]).optional(),
  transitionDuration: z.number().optional(),
  resolution: z.enum(["720p", "1080p"]).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional(),
  fps: z.number().optional(),
  quality: z.enum(["standard", "high", "ultra"]).optional(),
  burnSubtitles: z.boolean().optional(),
  subtitlePosition: z.enum(["bottom", "middle", "top"]).optional(),
});

function recompute(clips: SceneClip[]): number {
  let cursor = 0;
  for (const c of clips) {
    const d = Math.max(0.5, c.durationSeconds - (c.trimStart ?? 0) - (c.trimEnd ?? 0));
    c.startTime = cursor;
    c.endTime = cursor + d;
    cursor += d;
  }
  return cursor;
}

/** Persist the edited MovieManifest back to the project (video_file column). */
export const saveMovieManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string(), manifest: ManifestSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const clips = data.manifest.clips.map((c) => ({ ...c })) as SceneClip[];
    const total = recompute(clips);
    const manifest: MovieManifest = {
      ...data.manifest,
      clips,
      url: clips[0]?.url ?? data.manifest.url,
      kind: clips.length > 1 ? "chained" : "single",
      totalDurationSeconds: total,
    };
    const { error } = await context.supabase
      .from("projects")
      .update({ video_file: manifest })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true, manifest };
  });

/** Regenerate a single scene clip and swap it into the manifest in place. */
export const regenerateClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      projectId: z.string(),
      sceneNumber: z.number(),
      clipNumber: z.number(),
      prompt: z.string().optional(),
      duration: z.number().min(2).max(10).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: proj, error } = await context.supabase
      .from("projects")
      .select("video_file")
      .eq("id", data.projectId)
      .single();
    if (error || !proj) throw new Error(error?.message ?? "Project not found.");
    const manifest = proj.video_file as MovieManifest | null;
    if (!manifest || !Array.isArray(manifest.clips)) throw new Error("No movie manifest to update.");
    const idx = manifest.clips.findIndex(
      (c) => c.sceneNumber === data.sceneNumber && c.clipNumber === data.clipNumber,
    );
    if (idx === -1) throw new Error("Clip not found in manifest.");
    const target = manifest.clips[idx];
    const prompt = data.prompt ?? target.prompt;
    const dur = data.duration ?? Math.max(2, Math.min(10, Math.round(target.durationSeconds)));
    const r = await generateWanVideo({
      data: { prompt, projectId: data.projectId, mode: "t2v", duration: dur },
    });
    manifest.clips[idx] = {
      ...target,
      prompt,
      url: r.url,
      cover: r.cover ?? target.cover,
      durationSeconds: dur,
      provider: r.provider,
      trimStart: 0,
      trimEnd: 0,
    };
    manifest.totalDurationSeconds = recompute(manifest.clips);
    manifest.url = manifest.clips[0]?.url ?? manifest.url;
    const { error: uerr } = await context.supabase
      .from("projects")
      .update({ video_file: manifest })
      .eq("id", data.projectId);
    if (uerr) throw new Error(uerr.message);
    return { ok: true, manifest };
  });

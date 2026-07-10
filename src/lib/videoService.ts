// Final video render service. Stub — no video provider connected yet.
// Future: stitch images + voice + music into MP4 via Wan and persist URL on
// projects.video_file. Render metadata (progress, duration, provider) is
// stored alongside on the projects row.

export type VideoAsset = {
  url: string | null;
  durationSeconds?: number;
  resolution?: string;
  status: "idle" | "queued" | "rendering" | "ready" | "error";
  error?: string;
};

export type VideoRenderJob = {
  provider: "wan" | "happy-horse" | (string & {});
  status: "pending" | "generating" | "completed" | "failed";
  progress: number;
  durationSeconds?: number;
  resolution?: string;
  aspectRatio?: string;
};

import { generateWanVideo } from "@/lib/wanVideo.functions";

export const videoService = {
  isConfigured(): boolean {
    return true;
  },
  defaultProvider(): VideoRenderJob["provider"] {
    return "wan";
  },
  async render(input: {
    prompt: string;
    projectId?: string;
    imageUrl?: string;
    mode?: "t2v" | "i2v" | "ref2v" | "edit";
    duration?: number;
  }): Promise<VideoAsset> {
    const r = await generateWanVideo({ data: input });
    return { url: r.url, status: "ready", durationSeconds: input.duration, resolution: "1280x720" };
  },
  parseAsset(value: string | null | undefined): VideoAsset {
    if (!value) return { url: null, status: "idle" };
    try {
      const parsed = JSON.parse(value) as Partial<VideoAsset>;
      return { url: parsed.url ?? null, durationSeconds: parsed.durationSeconds, resolution: parsed.resolution, status: parsed.url ? "ready" : "idle" };
    } catch {
      return { url: value, status: "ready" };
    }
  },
};

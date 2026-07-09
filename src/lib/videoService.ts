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

export const videoService = {
  isConfigured(): boolean {
    return false;
  },
  defaultProvider(): VideoRenderJob["provider"] {
    return "wan";
  },
  async render(_input: {
    images?: Array<{ url: string; durationSeconds?: number }>;
    audio?: string;
    music?: string;
    provider?: VideoRenderJob["provider"];
  }): Promise<VideoAsset> {
    throw new Error("Video renderer not connected yet.");
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

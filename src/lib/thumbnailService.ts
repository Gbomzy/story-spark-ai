// Thumbnail image service. Stub — no provider connected.
export type ThumbnailAsset = {
  url: string | null;
  width?: number;
  height?: number;
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

export const thumbnailService = {
  isConfigured(): boolean {
    return false;
  },
  async generate(_prompt: string): Promise<ThumbnailAsset> {
    throw new Error("Thumbnail provider not connected yet.");
  },
  parseAsset(value: string | null | undefined): ThumbnailAsset {
    if (!value) return { url: null, status: "idle" };
    try {
      const parsed = JSON.parse(value) as Partial<ThumbnailAsset>;
      return {
        url: parsed.url ?? null,
        width: parsed.width,
        height: parsed.height,
        status: parsed.url ? "ready" : "idle",
      };
    } catch {
      return { url: value, status: "ready" };
    }
  },
};
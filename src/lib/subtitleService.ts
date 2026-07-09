// Subtitle (.srt) service. Stub — no provider connected.
export type SubtitleAsset = {
  url: string | null;
  format: "srt" | "vtt";
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

export const subtitleService = {
  isConfigured(): boolean {
    return false;
  },
  async generateFromScript(_script: string): Promise<SubtitleAsset> {
    throw new Error("Subtitle provider not connected yet.");
  },
  parseAsset(value: string | null | undefined): SubtitleAsset {
    if (!value) return { url: null, format: "srt", status: "idle" };
    try {
      const parsed = JSON.parse(value) as Partial<SubtitleAsset>;
      return {
        url: parsed.url ?? null,
        format: parsed.format ?? "srt",
        status: parsed.url ? "ready" : "idle",
      };
    } catch {
      return { url: value, format: "srt", status: "ready" };
    }
  },
};
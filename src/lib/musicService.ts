// Music / song audio service. Stub — no music provider connected yet.
// Future: wire to a music provider, upload MP3 to storage, persist URL on projects.music.

export type MusicAsset = {
  url: string | null;
  durationSeconds?: number;
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

export const musicService = {
  isConfigured(): boolean {
    return false;
  },
  async generateFromLyrics(_lyrics: string, _opts?: { mood?: string; tempo?: string }): Promise<MusicAsset> {
    throw new Error("Music provider not connected yet.");
  },
  parseAsset(value: string | null | undefined): MusicAsset {
    if (!value) return { url: null, status: "idle" };
    try {
      const parsed = JSON.parse(value) as Partial<MusicAsset>;
      return { url: parsed.url ?? null, durationSeconds: parsed.durationSeconds, status: parsed.url ? "ready" : "idle" };
    } catch {
      return { url: value, status: "ready" };
    }
  },
};

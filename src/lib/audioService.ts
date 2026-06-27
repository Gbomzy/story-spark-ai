// Voice / narration audio service. Stub — no TTS provider connected yet.
// Future: wire to a TTS provider, upload MP3 to storage, persist URL on projects.audio.

export type AudioAsset = {
  url: string | null;
  durationSeconds?: number;
  voice?: string;
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

export const audioService = {
  isConfigured(): boolean {
    return false;
  },
  async generateFromScript(_script: string, _opts?: { voice?: string; language?: string }): Promise<AudioAsset> {
    throw new Error("Voice provider not connected yet.");
  },
  parseAsset(value: string | null | undefined): AudioAsset {
    if (!value) return { url: null, status: "idle" };
    try {
      const parsed = JSON.parse(value) as Partial<AudioAsset>;
      return { url: parsed.url ?? null, durationSeconds: parsed.durationSeconds, voice: parsed.voice, status: parsed.url ? "ready" : "idle" };
    } catch {
      return { url: value, status: "ready" };
    }
  },
};

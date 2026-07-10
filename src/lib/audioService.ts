// Voice / narration audio service.
//
// Wired to the Lovable AI Gateway (openai/gpt-4o-mini-tts) via the
// /api/generate-voice server route. The orchestrator (src/lib/orchestrator.ts)
// owns routing and metrics; this module keeps parse helpers and the flag.

import { generateCosyVoice } from "@/lib/cosyvoice.functions";

export type AudioAsset = {
  url: string | null;
  durationSeconds?: number;
  voice?: string;
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

export const audioService = {
  isConfigured(): boolean {
    return true;
  },
  async generateFromScript(
    script: string,
    opts?: { voice?: string; language?: string; speed?: number; pitch?: number; projectId?: string; model?: string },
  ): Promise<AudioAsset> {
    const r = await generateCosyVoice({
      data: {
        script,
        voice: opts?.voice,
        speed: opts?.speed,
        pitch: opts?.pitch,
        language: opts?.language,
        projectId: opts?.projectId,
        model: opts?.model,
      },
    });
    return { url: r.url, voice: r.voice, status: "ready" };
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

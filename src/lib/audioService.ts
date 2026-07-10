// Voice / narration audio service.
//
// Wired to the Lovable AI Gateway (openai/gpt-4o-mini-tts) via the
// /api/generate-voice server route. The orchestrator (src/lib/orchestrator.ts)
// owns routing and metrics; this module keeps parse helpers and the flag.

import { orchestrateVoice } from "@/lib/orchestrator";

export type AudioAsset = {
  url: string | null;
  durationSeconds?: number;
  voice?: string;
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

export const audioService = {
  isConfigured(): boolean {
    // Qwen Cloud does not currently expose speech synthesis to this project.
    return false;
  },
  async generateFromScript(
    script: string,
    opts?: { voice?: string; language?: string; speed?: number; projectId?: string },
  ): Promise<AudioAsset> {
    const r = await orchestrateVoice({
      script,
      voice: opts?.voice,
      speed: opts?.speed,
      projectId: opts?.projectId,
    });
    return { url: r.url, voice: opts?.voice, status: "ready" };
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

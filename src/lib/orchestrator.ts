// AI Provider Orchestrator (Phase 3).
//
// Central point for detecting which media providers are usable, routing
// generation calls, and recording metrics into `generation_history`. Only
// the image provider is wired to a real backend today (Lovable AI Gateway
// via /api/generate-image); voice, music, subtitles and video degrade
// gracefully with a clear "coming soon" signal so the rest of the app
// continues to work.

import { logGeneration } from "@/lib/assets";
import type { ProviderCapability } from "@/lib/providers";

export type OrchestratorProvider = {
  id: string;
  label: string;
  capability: ProviderCapability;
  status: "connected" | "coming_soon";
};

// Image generation is powered by Lovable AI Gateway (server-side); the client
// hits our own /api/generate-image route which reads LOVABLE_API_KEY.
export const ORCHESTRATOR: Record<ProviderCapability, OrchestratorProvider> = {
  text: { id: "qwen", label: "Qwen", capability: "text", status: "connected" },
  images: { id: "lovable-gemini-image", label: "Lovable AI · Gemini Image", capability: "images", status: "connected" },
  voice: { id: "lovable-openai-tts", label: "Lovable AI · OpenAI TTS", capability: "voice", status: "connected" },
  music: { id: "wan-music", label: "Music Provider", capability: "music", status: "coming_soon" },
  video: { id: "wan-video", label: "Wan AI Video", capability: "video", status: "coming_soon" },
  subtitles: { id: "auto-subtitles", label: "Auto Subtitles (local)", capability: "subtitles", status: "connected" },
};

export function isCapabilityAvailable(cap: ProviderCapability): boolean {
  return ORCHESTRATOR[cap]?.status === "connected";
}

export function providerFor(cap: ProviderCapability): OrchestratorProvider {
  return ORCHESTRATOR[cap];
}

/** Generate a scene image through the server-side gateway proxy. */
export async function orchestrateImage(input: {
  prompt: string;
  projectId?: string;
  sceneId?: string;
}): Promise<{ url: string; provider: string; durationMs: number; creditsUsed: number }> {
  const started = Date.now();
  const provider = ORCHESTRATOR.images.id;
  try {
    const res = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: input.prompt }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(detail || `Image generation failed (${res.status})`);
    }
    const data = (await res.json()) as { url: string; provider: string; durationMs: number; creditsUsed: number };
    // Best-effort history log — never block the caller on this.
    void logGeneration({
      project_id: input.projectId,
      asset_type: "generated_image",
      provider: data.provider ?? provider,
      status: "completed",
      duration_ms: data.durationMs ?? Date.now() - started,
      credits_used: data.creditsUsed ?? 0,
      metadata: { sceneId: input.sceneId },
    }).catch(() => undefined);
    return data;
  } catch (err) {
    void logGeneration({
      project_id: input.projectId,
      asset_type: "generated_image",
      provider,
      status: "failed",
      duration_ms: Date.now() - started,
      error_message: err instanceof Error ? err.message : String(err),
      metadata: { sceneId: input.sceneId },
    }).catch(() => undefined);
    throw err;
  }
}

/** Generate narration MP3 through the server-side voice proxy. */
export async function orchestrateVoice(input: {
  script: string;
  voice?: string;
  speed?: number;
  projectId?: string;
}): Promise<{ url: string; provider: string; durationMs: number; bytes: number }> {
  const started = Date.now();
  const provider = ORCHESTRATOR.voice.id;
  try {
    const res = await fetch("/api/generate-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: input.script, voice: input.voice, speed: input.speed }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(detail || `Voice generation failed (${res.status})`);
    }
    const data = (await res.json()) as { url: string; provider: string; durationMs: number; bytes: number };
    void logGeneration({
      project_id: input.projectId,
      asset_type: "voice_audio",
      provider: data.provider ?? provider,
      status: "completed",
      duration_ms: data.durationMs ?? Date.now() - started,
      credits_used: Math.ceil((data.bytes ?? 0) / 1024),
      metadata: { voice: input.voice ?? "alloy" },
    }).catch(() => undefined);
    return data;
  } catch (err) {
    void logGeneration({
      project_id: input.projectId,
      asset_type: "voice_audio",
      provider,
      status: "failed",
      duration_ms: Date.now() - started,
      error_message: err instanceof Error ? err.message : String(err),
    }).catch(() => undefined);
    throw err;
  }
}
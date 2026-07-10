// AI Provider Orchestrator — Qwen-only (Hackathon compliance).
//
// Every non-Qwen AI provider has been removed. Text generation is powered
// by Qwen directly (see src/lib/qwen.functions.ts). Image and voice
// generation are disabled because Qwen Cloud does not currently expose
// these capabilities to this project. Subtitles remain a local, non-AI
// utility. Music and video remain deferred.

import { logGeneration } from "@/lib/assets";
import type { ProviderCapability } from "@/lib/providers";

export const UNAVAILABLE_MESSAGE = "Unavailable with current Qwen capabilities.";

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
  images: { id: "qwen-image", label: "Qwen Image", capability: "images", status: "coming_soon" },
  voice: { id: "qwen-voice", label: "Qwen Voice", capability: "voice", status: "coming_soon" },
  music: { id: "qwen-music", label: "Qwen Music", capability: "music", status: "coming_soon" },
  video: { id: "qwen-video", label: "Qwen Video", capability: "video", status: "coming_soon" },
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
  void logGeneration({
    project_id: input.projectId,
    asset_type: "generated_image",
    provider: ORCHESTRATOR.images.id,
    status: "failed",
    error_message: UNAVAILABLE_MESSAGE,
    metadata: { sceneId: input.sceneId },
  }).catch(() => undefined);
  throw new Error(UNAVAILABLE_MESSAGE);
}

/** Generate narration MP3 through the server-side voice proxy. */
export async function orchestrateVoice(input: {
  script: string;
  voice?: string;
  speed?: number;
  projectId?: string;
}): Promise<{ url: string; provider: string; durationMs: number; bytes: number }> {
  void logGeneration({
    project_id: input.projectId,
    asset_type: "voice_audio",
    provider: ORCHESTRATOR.voice.id,
    status: "failed",
    error_message: UNAVAILABLE_MESSAGE,
    metadata: { voice: input.voice ?? null },
  }).catch(() => undefined);
  throw new Error(UNAVAILABLE_MESSAGE);
}
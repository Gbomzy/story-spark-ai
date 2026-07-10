// AI Provider Orchestrator — Qwen-only (Hackathon compliance).
//
// Every non-Qwen AI provider has been removed. Text generation is powered
// by Qwen directly (see src/lib/qwen.functions.ts). Image and voice
// generation are disabled because Qwen Cloud does not currently expose
// these capabilities to this project. Subtitles remain a local, non-AI
// utility. Music and video remain deferred.

import type { ProviderCapability } from "@/lib/providers";
import { generateQwenImage } from "@/lib/qwenImage.functions";
import { generateCosyVoice } from "@/lib/cosyvoice.functions";
import { generateWanVideo } from "@/lib/wanVideo.functions";

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
  images: { id: "qwen-image", label: "Qwen Image 2.0", capability: "images", status: "connected" },
  voice: { id: "cosyvoice", label: "CosyVoice", capability: "voice", status: "connected" },
  music: { id: "wan-music", label: "Wan Music", capability: "music", status: "coming_soon" },
  video: { id: "wan-t2v", label: "Wan Video", capability: "video", status: "connected" },
  subtitles: { id: "fun-asr", label: "Fun-ASR / Local", capability: "subtitles", status: "connected" },
};

export function isCapabilityAvailable(cap: ProviderCapability): boolean {
  return ORCHESTRATOR[cap]?.status === "connected";
}

export function providerFor(cap: ProviderCapability): OrchestratorProvider {
  return ORCHESTRATOR[cap];
}

/** Generate a scene image via DashScope (Qwen Image 2.0 / Wan T2I). */
export async function orchestrateImage(input: {
  prompt: string;
  projectId?: string;
  sceneId?: string;
  negativePrompt?: string;
  aspect?: string;
  seed?: number;
  model?: "wanx2.1-t2i-turbo" | "wanx2.1-t2i-plus" | "wan2.2-t2i-flash" | "wan2.2-t2i-plus";
}): Promise<{ url: string; provider: string; durationMs: number; creditsUsed: number }> {
  return await generateQwenImage({ data: input });
}

/** Generate narration MP3 through the server-side voice proxy. */
export async function orchestrateVoice(input: {
  script: string;
  voice?: string;
  speed?: number;
  projectId?: string;
}): Promise<{ url: string; provider: string; durationMs: number; bytes: number }> {
  const r = await generateCosyVoice({ data: input });
  return { url: r.url, provider: r.provider, durationMs: r.durationMs, bytes: r.bytes };
}

/** Render a final MP4 via Wan text-to-video / image-to-video. */
export async function orchestrateVideo(input: {
  prompt: string;
  projectId?: string;
  imageUrl?: string;
  refImageUrl?: string;
  mode?: "t2v" | "i2v" | "ref2v" | "edit";
  duration?: number;
  size?: string;
}): Promise<{ url: string; provider: string; durationMs: number; bytes: number; cover: string }> {
  const r = await generateWanVideo({ data: input });
  return { url: r.url, provider: r.provider, durationMs: r.durationMs, bytes: r.bytes, cover: r.cover };
}
// AI Producer — pure client-safe production estimator.
// Reuses the existing creditEstimator when possible; conservatively
// approximates counts from a prompt or an existing project.

import { estimate } from "@/lib/creditEstimator";

export type ProductionEstimate = {
  movieLengthSec: number;
  scenes: number;
  clips: number;
  imagesRequired: number;
  voiceDurationSec: number;
  videoDurationSec: number;
  creditsRequired: number;
  renderTimeSec: number;
  storageMb: number;
};

export type EstimateInput = {
  prompt: string;
  targetLengthSec?: number; // desired output length
  scenes?: number;          // if the storyboard already exists
  clipLenSec?: number;      // per clip default
  resolution?: "480p" | "720p" | "1080p" | "2k" | "4k";
};

function inferScenesFromPrompt(prompt: string, targetLenSec: number): number {
  const words = prompt.trim().split(/\s+/).filter(Boolean).length;
  // Very rough: more prompt = more scenes, bounded by target length.
  const base = Math.max(4, Math.round(words / 12));
  const byLen = Math.max(4, Math.round(targetLenSec / 8));
  return Math.min(24, Math.max(base, byLen));
}

export function estimateProduction(input: EstimateInput): ProductionEstimate {
  const targetLen = Math.max(30, input.targetLengthSec ?? 180);
  const scenes = input.scenes ?? inferScenesFromPrompt(input.prompt, targetLen);
  const clipLen = input.clipLenSec ?? Math.min(8, Math.max(4, Math.round(targetLen / scenes)));
  const clips = scenes;
  const imagesRequired = scenes;
  const voiceDurationSec = targetLen;
  const videoDurationSec = clips * clipLen;
  const resolution = input.resolution ?? "1080p";

  // Sum credits across the major stages using the existing estimator.
  const storyCredits = estimate({ kind: "text", words: Math.round(targetLen * 2.5) }).credits;
  const imageCredits = estimate({ kind: "image", scenes: imagesRequired }).credits;
  const voiceCredits = estimate({ kind: "voice", seconds: voiceDurationSec }).credits;
  const videoCredits = estimate({ kind: "video", seconds: videoDurationSec, resolution }).credits;
  const musicCredits = estimate({ kind: "music", seconds: voiceDurationSec }).credits;
  const thumbnailCredits = estimate({ kind: "image", scenes: 1 }).credits;
  const seoCredits = estimate({ kind: "text", words: 300 }).credits;
  const creditsRequired =
    storyCredits + imageCredits + voiceCredits + videoCredits + musicCredits + thumbnailCredits + seoCredits;

  // Render time: roughly clip generation is the dominant cost.
  const renderTimeSec = clips * 30 + Math.round(voiceDurationSec / 4) + imagesRequired * 6;
  const storageMb = clips * 8 + imagesRequired * 0.6 + Math.round(voiceDurationSec / 60) * 1.5;

  return {
    movieLengthSec: targetLen,
    scenes,
    clips,
    imagesRequired,
    voiceDurationSec,
    videoDurationSec,
    creditsRequired,
    renderTimeSec: Math.round(renderTimeSec),
    storageMb: Math.round(storageMb),
  };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem.toString().padStart(2, "0")}s`;
}

export function formatStorage(mb: number): string {
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
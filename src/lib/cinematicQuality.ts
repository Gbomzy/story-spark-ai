// Cinematic Quality Validator — produce a 0-100 score for a finished
// movie project by inspecting its Story Bible, shot plans, video
// manifest, and narration segments.

import type { StoryBible } from "@/lib/storyBible";
import type { CinematicShotPlan } from "@/lib/cinematicDirector";

export type QualityCheck = {
  key: string;
  label: string;
  score: number; // 0..100
  weight: number;
  passed: boolean;
  detail: string;
};

export type CinematicQualityReport = {
  score: number;             // weighted 0..100
  grade: "A" | "B" | "C" | "D" | "F";
  checks: QualityCheck[];
  strengths: string[];
  issues: string[];
};

export type QualityInput = {
  bible?: StoryBible | null;
  shotPlans?: CinematicShotPlan[];
  clips?: Array<{ prompt?: string; url?: string; durationSeconds?: number }>;
  narrationSegments?: number;
  narrationDurationSec?: number;
  musicUrl?: string | null;
  transitions?: string[];
};

function grade(score: number): CinematicQualityReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function validateCinematicQuality(input: QualityInput): CinematicQualityReport {
  const checks: QualityCheck[] = [];
  const strengths: string[] = [];
  const issues: string[] = [];

  const chars = input.bible?.characters ?? [];
  const charOk = chars.length > 0 && chars.every((c) => (c.appearance ?? "").length > 10);
  checks.push({
    key: "character_consistency",
    label: "Character consistency",
    weight: 12,
    score: charOk ? 100 : chars.length > 0 ? 60 : 30,
    passed: charOk,
    detail: chars.length ? `${chars.length} character profiles${charOk ? "" : " — appearances thin"}` : "No character profiles in Story Bible",
  });

  const clothingOk = chars.every((c) => /wear|cloth|shirt|dress|jacket|robe|hat/.test(c.appearance ?? ""));
  checks.push({
    key: "clothing_consistency", label: "Clothing consistency", weight: 8,
    score: clothingOk && chars.length ? 100 : 55, passed: clothingOk && chars.length > 0,
    detail: clothingOk ? "Clothing described for all characters" : "Some characters lack clothing detail",
  });

  const worldOk = !!(input.bible?.world && input.bible.world.length > 20);
  checks.push({
    key: "world_consistency", label: "World consistency", weight: 10,
    score: worldOk ? 100 : 40, passed: worldOk,
    detail: worldOk ? "World Bible present" : "World Bible missing or thin",
  });

  const shots = input.shotPlans ?? [];
  const uniqueShots = new Set(shots.map((s) => s.cameraShot)).size;
  const varietyPct = shots.length ? Math.min(100, (uniqueShots / Math.min(6, shots.length)) * 100) : 0;
  checks.push({
    key: "camera_variety", label: "Camera variety", weight: 10,
    score: varietyPct, passed: varietyPct >= 70,
    detail: `${uniqueShots} distinct shot types across ${shots.length} scenes`,
  });

  const motionAvg = shots.length
    ? shots.reduce((n, s) => n + s.motionInstructions.length, 0) / shots.length
    : 0;
  checks.push({
    key: "motion_quality", label: "Motion quality", weight: 10,
    score: Math.min(100, motionAvg * 25), passed: motionAvg >= 3,
    detail: `${motionAvg.toFixed(1)} motion cues per scene`,
  });

  const rhythmOk = (input.narrationSegments ?? 0) > 1;
  checks.push({
    key: "narration_rhythm", label: "Narration rhythm", weight: 8,
    score: rhythmOk ? 90 : 55, passed: rhythmOk,
    detail: rhythmOk ? `${input.narrationSegments} paced segments` : "Narration not segmented",
  });

  const musicOk = !!input.musicUrl;
  checks.push({
    key: "music_continuity", label: "Music continuity", weight: 8,
    score: musicOk ? 95 : 50, passed: musicOk,
    detail: musicOk ? "Background music present" : "No background music",
  });

  const trans = input.transitions ?? shots.map((s) => s.transition);
  const transVariety = new Set(trans).size;
  checks.push({
    key: "scene_transitions", label: "Scene transitions", weight: 6,
    score: trans.length ? Math.min(100, (transVariety / Math.min(4, trans.length)) * 100) : 50,
    passed: transVariety >= 2,
    detail: `${transVariety} transition types`,
  });

  const lightingSet = new Set(shots.map((s) => s.lightingStyle));
  const lightingOk = lightingSet.size > 0 && lightingSet.size <= Math.max(3, Math.ceil(shots.length / 3));
  checks.push({
    key: "lighting_continuity", label: "Lighting continuity", weight: 8,
    score: lightingOk ? 90 : 60, passed: lightingOk,
    detail: `${lightingSet.size} lighting styles${lightingOk ? " (coherent)" : " (too varied)"}`,
  });

  const paletteSet = new Set(shots.map((s) => s.colorPalette));
  const paletteOk = paletteSet.size > 0 && paletteSet.size <= Math.max(3, Math.ceil(shots.length / 3));
  checks.push({
    key: "color_consistency", label: "Color consistency", weight: 8,
    score: paletteOk ? 90 : 55, passed: paletteOk,
    detail: `${paletteSet.size} palettes${paletteOk ? " (consistent)" : " (fragmented)"}`,
  });

  const clipsOk = (input.clips ?? []).every((c) => c.url && c.url.length > 0);
  checks.push({
    key: "story_continuity", label: "Story continuity", weight: 12,
    score: clipsOk && (input.clips?.length ?? 0) > 0 ? 95 : 55,
    passed: clipsOk && (input.clips?.length ?? 0) > 0,
    detail: `${input.clips?.length ?? 0} clips${clipsOk ? " all rendered" : " incomplete"}`,
  });

  const totalWeight = checks.reduce((n, c) => n + c.weight, 0);
  const weighted = checks.reduce((n, c) => n + (c.score * c.weight), 0);
  const score = Math.round(weighted / totalWeight);

  for (const c of checks) {
    if (c.score >= 85) strengths.push(c.label);
    else if (c.score < 65) issues.push(`${c.label}: ${c.detail}`);
  }

  return { score, grade: grade(score), checks, strengths, issues };
}
// StorySpark AI Director V2 — pure, additive intelligence layer that
// analyzes a storyboard and produces a full "director report":
//   • emotion scores per scene
//   • scene importance (1–10)
//   • camera plan (reuses cinematicDirector shot rules)
//   • motion / lighting / color script
//   • music plan
//   • transition plan
//   • quality grades + overall Director Grade (A+..D)
//   • runtime + engagement predictions
//   • prompt optimization for image / video generators
//
// No network, no side effects, no dependencies on server-only modules.
// Safe to import from both client bundles and server functions.

import {
  buildShotPlan,
  enrichVideoPrompt,
  enrichImagePrompt,
  type CameraShot,
  type CinematicShotPlan,
  type SceneRole,
} from "@/lib/cinematicDirector";
import type { SceneDirection, DirectionMap } from "@/lib/aiDirector.functions";

// ---------- Types ----------

export const EMOTIONS = [
  "happiness",
  "excitement",
  "mystery",
  "sadness",
  "danger",
  "celebration",
  "friendship",
  "surprise",
  "tension",
  "humor",
] as const;
export type Emotion = (typeof EMOTIONS)[number];
export type EmotionScores = Record<Emotion, number>;

export type FacialExpression =
  | "smile"
  | "surprised"
  | "thinking"
  | "laughing"
  | "worried"
  | "crying"
  | "excited"
  | "confident"
  | "sleepy"
  | "curious";

export type LightingStyle =
  | "morning"
  | "sunset"
  | "night"
  | "rain"
  | "magic glow"
  | "warm classroom"
  | "forest sunlight"
  | "moonlight"
  | "golden hour"
  | "festival lights";

export type TransitionKind =
  | "cut"
  | "fade"
  | "crossfade"
  | "slide"
  | "whip"
  | "dissolve"
  | "push"
  | "match cut";

export type ColorPhase = "opening" | "rising" | "conflict" | "ending";

export type MusicPlan = {
  mood: string;
  tempoBpm: number;
  instruments: string[];
  energy: number; // 0–100
  fadeIn: boolean;
  fadeOut: boolean;
  ducking: boolean;
  transition: "hard cut" | "crossfade" | "swell" | "fade out";
};

export type DirectorSceneReport = {
  sceneId: string;
  sceneNumber: number;
  role: SceneRole;
  importance: number; // 1–10
  emotions: EmotionScores;
  dominantEmotion: Emotion;
  facialExpression: FacialExpression;
  lighting: LightingStyle;
  colorPhase: ColorPhase;
  colorPalette: string;
  motion: string[];
  transition: TransitionKind;
  music: MusicPlan;
  shot: CinematicShotPlan;
  targetDurationSeconds: number;
  pacing: "slow" | "medium" | "fast";
  engagementScore: number; // 0–100
  optimizedImagePrompt: string;
  optimizedVideoPrompt: string;
  notes: string[];
};

export type QualityGrades = {
  storyQuality: number;
  animationQuality: number;
  visualVariety: number;
  cameraVariety: number;
  dialogueQuality: number;
  emotionQuality: number;
  educationalValue: number;
  entertainmentValue: number;
  overall: number;
  grade: "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";
};

export type DirectorReport = {
  scenes: DirectorSceneReport[];
  emotionGraph: Array<{ sceneNumber: number; dominant: Emotion; scores: EmotionScores }>;
  paceGraph: Array<{ sceneNumber: number; importance: number; duration: number; energy: number }>;
  colorScript: Array<{ sceneNumber: number; phase: ColorPhase; palette: string }>;
  motionPlan: Array<{ sceneNumber: number; motion: string[] }>;
  musicPlan: Array<{ sceneNumber: number; music: MusicPlan }>;
  cameraPlan: Array<{ sceneNumber: number; shot: CameraShot; movement: string; lens: string }>;
  lightingPlan: Array<{ sceneNumber: number; lighting: LightingStyle }>;
  transitions: Array<{ sceneNumber: number; transition: TransitionKind }>;
  quality: QualityGrades;
  runtimeSeconds: number;
  audienceEngagement: number; // 0–100
  overallMovieScore: number; // 0–100
  directionMap: DirectionMap; // additive: writable to story_bible.direction
  summary: string;
};

// ---------- Emotion engine ----------

const EMOTION_KEYWORDS: Record<Emotion, RegExp> = {
  happiness: /(happy|joy|smile|glad|cheerful|delight)/i,
  excitement: /(excite|thrill|amaz|wow|energetic|adventur)/i,
  mystery: /(mystery|secret|shadow|strange|whisper|hidden|clue)/i,
  sadness: /(sad|cry|tears?|lonely|miss|sorrow|heartbroken)/i,
  danger: /(danger|fear|scary|threat|monster|storm|attack|chase|fight)/i,
  celebration: /(party|celebrat|festival|birthday|cheer|applause|victory)/i,
  friendship: /(friend|together|help|share|kind|hug|bond)/i,
  surprise: /(suddenly|surpris|unexpect|gasp|shock|reveal)/i,
  tension: /(tense|worried|nervous|anxious|holding breath|silent)/i,
  humor: /(laugh|funny|silly|joke|giggle|hilarious)/i,
};

export function scoreEmotions(text: string): EmotionScores {
  const t = text ?? "";
  const scores = {} as EmotionScores;
  let total = 0;
  for (const e of EMOTIONS) {
    const rx = EMOTION_KEYWORDS[e];
    const matches = (t.match(new RegExp(rx.source, rx.flags + (rx.flags.includes("g") ? "" : "g"))) ?? []).length;
    const s = Math.min(10, matches * 3);
    scores[e] = s;
    total += s;
  }
  // Ensure at least a small baseline so charts render
  if (total === 0) {
    scores.happiness = 2;
    scores.friendship = 2;
  }
  return scores;
}

export function dominantEmotion(scores: EmotionScores): Emotion {
  let best: Emotion = "happiness";
  let bestScore = -1;
  for (const e of EMOTIONS) {
    if (scores[e] > bestScore) {
      bestScore = scores[e];
      best = e;
    }
  }
  return best;
}

// ---------- Scene importance ----------

export function sceneImportance(args: {
  index: number;
  total: number;
  text: string;
  role: SceneRole;
  emotions: EmotionScores;
}): number {
  const { index, total, text, role, emotions } = args;
  let score = 5;
  // Structural weight
  if (role === "opening" || role === "ending") score += 2;
  if (role === "climax") score += 3;
  if (role === "discovery" || role === "emotional") score += 2;
  if (role === "transition") score -= 1;
  // Emotional weight
  const emotionalPeak = Math.max(...EMOTIONS.map((e) => emotions[e]));
  if (emotionalPeak >= 6) score += 2;
  else if (emotionalPeak >= 3) score += 1;
  // Length signal
  const words = (text ?? "").split(/\s+/).filter(Boolean).length;
  if (words > 60) score += 1;
  if (words > 140) score += 1;
  // Position near end tends to matter more
  const pos = total > 1 ? index / (total - 1) : 0;
  if (pos > 0.7 && pos < 0.95) score += 1;
  return Math.max(1, Math.min(10, score));
}

// ---------- Facial expression director ----------

export function pickFacialExpression(dom: Emotion, role: SceneRole): FacialExpression {
  const byEmotion: Record<Emotion, FacialExpression> = {
    happiness: "smile",
    excitement: "excited",
    mystery: "curious",
    sadness: "crying",
    danger: "worried",
    celebration: "laughing",
    friendship: "smile",
    surprise: "surprised",
    tension: "thinking",
    humor: "laughing",
  };
  if (role === "opening" || role === "introduction") return "curious";
  if (role === "climax") return dom === "sadness" ? "crying" : "confident";
  if (role === "ending") return "smile";
  return byEmotion[dom];
}

// ---------- Lighting director ----------

export function pickLighting(text: string, timeOfDay: string, dom: Emotion): LightingStyle {
  const t = (text ?? "").toLowerCase();
  if (/rain|storm|thunder/.test(t)) return "rain";
  if (/festival|carnival|parade|lantern/.test(t)) return "festival lights";
  if (/magic|glow|spell|shimmer|sparkle/.test(t)) return "magic glow";
  if (/moon|midnight|starry/.test(t)) return "moonlight";
  if (/forest|woods|trees/.test(t)) return "forest sunlight";
  if (/classroom|school/.test(t)) return "warm classroom";
  if (/sunset|dusk|evening/.test(t) || timeOfDay === "evening") return "sunset";
  if (/dawn|sunrise|morning/.test(t) || timeOfDay === "morning") return "morning";
  if (timeOfDay === "night") return dom === "danger" ? "moonlight" : "night";
  return "golden hour";
}

// ---------- Color script ----------

export function colorPhaseFor(index: number, total: number, role: SceneRole): ColorPhase {
  const pos = total > 1 ? index / (total - 1) : 0;
  if (role === "climax" || (pos >= 0.55 && pos < 0.85)) return "conflict";
  if (role === "ending" || pos >= 0.85) return "ending";
  if (pos < 0.25) return "opening";
  return "rising";
}

const COLOR_PALETTES: Record<ColorPhase, string> = {
  opening: "bright warm pastels, soft yellows and sky blues",
  rising: "saturated primaries with cool shadows",
  conflict: "dramatic contrast, deep teals and amber highlights",
  ending: "warm vibrant golden hour, magenta sky, coral highlights",
};

// ---------- Motion director (extension of cinematic motion) ----------

const EXTRA_MOTION_BY_EMOTION: Record<Emotion, string[]> = {
  happiness: ["butterflies flying", "gentle character bounce"],
  excitement: ["camera shake", "character running", "sparkles rising"],
  mystery: ["slow drifting fog", "flickering shadow"],
  sadness: ["slow head tilt", "single tear"],
  danger: ["quick head turn", "cloth flap in wind"],
  celebration: ["confetti fall", "streamers waving"],
  friendship: ["hand reach", "shared glance"],
  surprise: ["eye widen", "sudden step back"],
  tension: ["chest breath rise", "eye dart"],
  humor: ["shoulder shake laugh", "head tilt"],
};

export function enrichMotion(base: string[], dom: Emotion): string[] {
  const extra = EXTRA_MOTION_BY_EMOTION[dom] ?? [];
  return Array.from(new Set([...base, ...extra])).slice(0, 6);
}

// ---------- Transition director ----------

export function pickTransition(
  prev: DirectorSceneReport | undefined,
  role: SceneRole,
  dom: Emotion,
): TransitionKind {
  if (!prev) return "fade";
  if (role === "climax") return "match cut";
  if (role === "ending") return "fade";
  if (dom === "surprise") return "whip";
  if (dom === "mystery") return "dissolve";
  if (dom === "danger" || dom === "excitement") return "cut";
  if (dom === "sadness") return "crossfade";
  if (prev.dominantEmotion === dom) return "cut";
  return "crossfade";
}

// ---------- Music director ----------

export function planMusic(dom: Emotion, importance: number, role: SceneRole): MusicPlan {
  const table: Record<Emotion, Omit<MusicPlan, "energy" | "fadeIn" | "fadeOut" | "ducking" | "transition">> = {
    happiness: { mood: "warm and playful", tempoBpm: 108, instruments: ["ukulele", "piano", "hand claps"] },
    excitement: { mood: "energetic adventure", tempoBpm: 138, instruments: ["strings", "drums", "brass"] },
    mystery: { mood: "curious and hushed", tempoBpm: 78, instruments: ["celesta", "pizzicato strings", "harp"] },
    sadness: { mood: "tender and reflective", tempoBpm: 62, instruments: ["solo piano", "cello", "soft pads"] },
    danger: { mood: "tense and driving", tempoBpm: 128, instruments: ["low strings", "percussion", "brass"] },
    celebration: { mood: "joyful festive", tempoBpm: 124, instruments: ["strings", "brass", "bells"] },
    friendship: { mood: "warm and hopeful", tempoBpm: 96, instruments: ["acoustic guitar", "piano", "strings"] },
    surprise: { mood: "playful sting", tempoBpm: 112, instruments: ["marimba", "harp glissando", "brass stab"] },
    tension: { mood: "suspenseful bed", tempoBpm: 84, instruments: ["tremolo strings", "sub bass", "ticking"] },
    humor: { mood: "cheeky and light", tempoBpm: 118, instruments: ["pizzicato strings", "bassoon", "woodblock"] },
  };
  const base = table[dom];
  const energy = Math.max(20, Math.min(100, importance * 8 + (role === "climax" ? 15 : 0)));
  return {
    ...base,
    energy,
    fadeIn: role === "opening",
    fadeOut: role === "ending",
    ducking: role === "dialogue" || role === "emotional",
    transition: role === "ending" ? "fade out" : role === "climax" ? "swell" : "crossfade",
  };
}

// ---------- Duration & pacing ----------

export function targetDuration(importance: number, role: SceneRole): number {
  // Base 4s + up to +6s from importance
  let secs = 4 + Math.round(importance * 0.6);
  if (role === "opening" || role === "ending") secs += 2;
  if (role === "climax") secs += 2;
  if (role === "transition") secs = Math.max(3, secs - 2);
  return Math.max(3, Math.min(12, secs));
}

export function pacingFor(importance: number, role: SceneRole): "slow" | "medium" | "fast" {
  if (role === "action" || role === "climax") return "fast";
  if (role === "emotional" || role === "ending") return "slow";
  return importance >= 7 ? "slow" : importance <= 4 ? "fast" : "medium";
}

// ---------- Prompt optimization ----------

function optimizePrompt(base: string): string {
  return (base ?? "")
    .replace(/\s+/g, " ")
    .replace(/([.,!?])\1+/g, "$1")
    .replace(/\b(very|really|just|kind of|sort of)\s+/gi, "")
    .replace(/(\b\w+\b)(?:\s+\1\b){1,}/gi, "$1")
    .trim();
}

// ---------- Report builder ----------

export type DirectorSceneInput = {
  id: string;
  prompt: string; // scene narration / description
  direction?: Partial<SceneDirection>;
};

export function buildDirectorReport(scenes: DirectorSceneInput[]): DirectorReport {
  const total = scenes.length;
  const out: DirectorSceneReport[] = [];
  let prevShot: CameraShot | undefined;
  let prev: DirectorSceneReport | undefined;
  const directionMap: DirectionMap = {};

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const emotions = scoreEmotions(s.prompt);
    const dom = dominantEmotion(emotions);
    const plan = buildShotPlan({
      sceneId: s.id,
      sceneNumber: i + 1,
      total,
      text: s.prompt,
      direction: s.direction,
      prevShot,
    });
    prevShot = plan.cameraShot;

    const importance = sceneImportance({ index: i, total, text: s.prompt, role: plan.role, emotions });
    const phase = colorPhaseFor(i, total, plan.role);
    const palette = COLOR_PALETTES[phase];
    const lighting = pickLighting(s.prompt, plan.timeOfDay, dom);
    const expression = pickFacialExpression(dom, plan.role);
    const motion = enrichMotion(plan.motionInstructions, dom);
    const transition = pickTransition(prev, plan.role, dom);
    const music = planMusic(dom, importance, plan.role);
    const duration = targetDuration(importance, plan.role);
    const pacing = pacingFor(importance, plan.role);

    // Feed enrichment back into the cinematic plan so downstream generators
    // consume the upgraded direction without any API change.
    const enrichedPlan: CinematicShotPlan = {
      ...plan,
      colorPalette: palette,
      lightingStyle: lighting,
      facialExpression: expression,
      motionInstructions: motion,
      transition: mapTransitionForShotPlan(transition),
    };

    const imgPrompt = optimizePrompt(enrichImagePrompt(s.prompt, enrichedPlan));
    const vidPrompt = optimizePrompt(enrichVideoPrompt(s.prompt, enrichedPlan));

    const engagement = Math.min(
      100,
      Math.round(importance * 6 + music.energy * 0.3 + (dom === "excitement" || dom === "celebration" ? 10 : 0)),
    );

    // Additive: also write a SceneDirection row (compatible with existing
    // story_bible.direction map + applyDirectionToPrompt consumers).
    directionMap[s.id] = {
      cameraAngle: enrichedPlan.cameraAngle,
      cameraDistance: enrichedPlan.cameraShot,
      cameraMovement: enrichedPlan.cameraMovement,
      lighting: enrichedPlan.lightingStyle,
      weather: enrichedPlan.weather,
      timeOfDay: enrichedPlan.timeOfDay,
      emotion: dom,
      musicMood: music.mood,
      transition: enrichedPlan.transition,
      colorPalette: enrichedPlan.colorPalette,
    };

    const notes: string[] = [];
    if (importance >= 8) notes.push("Key story beat — hold longer, extra visual detail.");
    if (plan.role === "climax") notes.push("Climax — match-cut in, swelling score.");
    if (dom === "mystery") notes.push("Preserve negative space and shadow contrast.");

    const sceneReport: DirectorSceneReport = {
      sceneId: s.id,
      sceneNumber: i + 1,
      role: plan.role,
      importance,
      emotions,
      dominantEmotion: dom,
      facialExpression: expression,
      lighting,
      colorPhase: phase,
      colorPalette: palette,
      motion,
      transition,
      music,
      shot: enrichedPlan,
      targetDurationSeconds: duration,
      pacing,
      engagementScore: engagement,
      optimizedImagePrompt: imgPrompt,
      optimizedVideoPrompt: vidPrompt,
      notes,
    };
    out.push(sceneReport);
    prev = sceneReport;
  }

  const quality = gradeQuality(out);
  const runtimeSeconds = out.reduce((a, s) => a + s.targetDurationSeconds, 0);
  const audienceEngagement = Math.round(
    out.reduce((a, s) => a + s.engagementScore, 0) / Math.max(1, out.length),
  );
  const overallMovieScore = Math.round((quality.overall + audienceEngagement) / 2);

  return {
    scenes: out,
    emotionGraph: out.map((s) => ({ sceneNumber: s.sceneNumber, dominant: s.dominantEmotion, scores: s.emotions })),
    paceGraph: out.map((s) => ({
      sceneNumber: s.sceneNumber,
      importance: s.importance,
      duration: s.targetDurationSeconds,
      energy: s.music.energy,
    })),
    colorScript: out.map((s) => ({ sceneNumber: s.sceneNumber, phase: s.colorPhase, palette: s.colorPalette })),
    motionPlan: out.map((s) => ({ sceneNumber: s.sceneNumber, motion: s.motion })),
    musicPlan: out.map((s) => ({ sceneNumber: s.sceneNumber, music: s.music })),
    cameraPlan: out.map((s) => ({
      sceneNumber: s.sceneNumber,
      shot: s.shot.cameraShot,
      movement: s.shot.cameraMovement,
      lens: s.shot.cameraLens,
    })),
    lightingPlan: out.map((s) => ({ sceneNumber: s.sceneNumber, lighting: s.lighting })),
    transitions: out.map((s) => ({ sceneNumber: s.sceneNumber, transition: s.transition })),
    quality,
    runtimeSeconds,
    audienceEngagement,
    overallMovieScore,
    directionMap,
    summary: summarize(out, quality, runtimeSeconds, audienceEngagement),
  };
}

// Downgrade V2 transitions into the narrower set used by CinematicShotPlan.
function mapTransitionForShotPlan(t: TransitionKind): CinematicShotPlan["transition"] {
  switch (t) {
    case "whip":
    case "push":
    case "slide":
      return "cut";
    case "match cut":
      return "match cut";
    case "crossfade":
      return "crossfade";
    case "dissolve":
      return "dissolve";
    case "fade":
      return "fade";
    default:
      return "cut";
  }
}

// ---------- Quality grading ----------

function gradeQuality(scenes: DirectorSceneReport[]): QualityGrades {
  const n = Math.max(1, scenes.length);
  const uniqueShots = new Set(scenes.map((s) => s.shot.cameraShot)).size;
  const uniqueLighting = new Set(scenes.map((s) => s.lighting)).size;
  const uniquePalettes = new Set(scenes.map((s) => s.colorPalette)).size;
  const uniqueEmotions = new Set(scenes.map((s) => s.dominantEmotion)).size;

  const cameraVariety = Math.min(100, Math.round((uniqueShots / Math.min(n, 8)) * 100));
  const visualVariety = Math.min(100, Math.round(((uniqueLighting + uniquePalettes) / Math.min(n * 2, 12)) * 100));
  const emotionQuality = Math.min(100, Math.round((uniqueEmotions / Math.min(n, 6)) * 100));

  const dialogueScenes = scenes.filter((s) => s.role === "dialogue").length;
  const dialogueQuality = Math.round(Math.min(100, 60 + dialogueScenes * 8));

  const importanceAvg = scenes.reduce((a, s) => a + s.importance, 0) / n;
  const storyQuality = Math.round(50 + importanceAvg * 5);

  const animationQuality = Math.round(
    60 + scenes.reduce((a, s) => a + Math.min(10, s.motion.length * 2), 0) / n,
  );

  const educationalValue = Math.round(
    60 +
      scenes.filter((s) => /learn|lesson|discover|explain|why|how/i.test(s.optimizedImagePrompt)).length * 5,
  );
  const entertainmentValue = Math.round(
    (emotionQuality + visualVariety + cameraVariety) / 3,
  );

  const overall = Math.round(
    (storyQuality * 0.18 +
      animationQuality * 0.12 +
      visualVariety * 0.12 +
      cameraVariety * 0.12 +
      dialogueQuality * 0.08 +
      emotionQuality * 0.14 +
      educationalValue * 0.1 +
      entertainmentValue * 0.14),
  );

  return {
    storyQuality: clamp(storyQuality),
    animationQuality: clamp(animationQuality),
    visualVariety: clamp(visualVariety),
    cameraVariety: clamp(cameraVariety),
    dialogueQuality: clamp(dialogueQuality),
    emotionQuality: clamp(emotionQuality),
    educationalValue: clamp(educationalValue),
    entertainmentValue: clamp(entertainmentValue),
    overall: clamp(overall),
    grade: gradeLetter(overall),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function gradeLetter(n: number): QualityGrades["grade"] {
  if (n >= 93) return "A+";
  if (n >= 87) return "A";
  if (n >= 82) return "B+";
  if (n >= 75) return "B";
  if (n >= 68) return "C+";
  if (n >= 60) return "C";
  return "D";
}

function summarize(
  scenes: DirectorSceneReport[],
  q: QualityGrades,
  runtimeSeconds: number,
  engagement: number,
): string {
  const peak = [...scenes].sort((a, b) => b.importance - a.importance)[0];
  const mm = Math.floor(runtimeSeconds / 60);
  const ss = runtimeSeconds % 60;
  return (
    `${scenes.length} scenes · ${mm}m ${ss}s runtime · overall ${q.overall}/100 (${q.grade}) · ` +
    `predicted audience engagement ${engagement}/100. ` +
    `Peak beat: scene ${peak?.sceneNumber} (${peak?.role}, ${peak?.dominantEmotion}).`
  );
}

// ---------- Public prompt helpers (backwards compatible) ----------

/** Convenience: apply Director V2 optimizations to an existing prompt if a
 *  scene report is available; otherwise return the original prompt untouched. */
export function applyDirectorV2ImagePrompt(base: string, scene?: DirectorSceneReport): string {
  return scene ? scene.optimizedImagePrompt : base;
}
export function applyDirectorV2VideoPrompt(base: string, scene?: DirectorSceneReport): string {
  return scene ? scene.optimizedVideoPrompt : base;
}
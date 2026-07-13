// Cinematic Director — pure helpers that turn a storyboard into a
// professional Director's Shot Plan and enrich video prompts with
// motion + composition + quality tags.
//
// No side effects, no network. Safe to import from server functions and
// from client bundles.

import type { SceneDirection } from "@/lib/aiDirector.functions";

export type CameraShot =
  | "establishing"
  | "wide"
  | "medium"
  | "close-up"
  | "extreme close-up"
  | "over-the-shoulder"
  | "two-shot"
  | "tracking"
  | "dolly"
  | "push-in"
  | "pull-out"
  | "reveal";

export type CameraLens =
  | "wide 24mm"
  | "standard 35mm"
  | "portrait 50mm"
  | "telephoto 85mm"
  | "macro"
  | "anamorphic";

export type SceneRole =
  | "opening"
  | "introduction"
  | "dialogue"
  | "emotional"
  | "action"
  | "discovery"
  | "transition"
  | "climax"
  | "resolution"
  | "ending";

export type CinematicShotPlan = {
  sceneId: string;
  sceneNumber: number;
  role: SceneRole;
  sceneGoal: string;
  emotionalIntent: string;
  cameraShot: CameraShot;
  cameraAngle: string;
  cameraLens: CameraLens;
  cameraMovement: string;
  characterBlocking: string;
  facialExpression: string;
  bodyLanguage: string;
  lightingStyle: string;
  timeOfDay: string;
  weather: string;
  backgroundMood: string;
  colorPalette: string;
  transition: "cut" | "fade" | "crossfade" | "dissolve" | "slide" | "match cut";
  motionInstructions: string[];
  soundDesignNotes: string;
};

// ---------- Scene role detection ----------

export function detectSceneRole(
  index: number,
  total: number,
  text: string,
): SceneRole {
  const t = (text ?? "").toLowerCase();
  if (index === 0) return "opening";
  if (index === total - 1) return "ending";
  if (/(said|asked|replied|shouted|whispered|"|“)/.test(t)) return "dialogue";
  if (/(discover|realize|found|suddenly saw|reveal)/.test(t)) return "discovery";
  if (/(ran|jumped|leapt|chased|fought|explod|crash)/.test(t)) return "action";
  if (/(cried|smiled|hugged|hearts?|missed|loved|sad|tears)/.test(t)) return "emotional";
  if (/(finally|at last|celebrat|home|together)/.test(t) && index > total * 0.6) return "resolution";
  if (index >= total * 0.7) return "climax";
  if (index <= 1) return "introduction";
  return "transition";
}

// ---------- Camera language rules ----------

const ROLE_SHOT: Record<SceneRole, { shot: CameraShot; lens: CameraLens; move: string }> = {
  opening: { shot: "establishing", lens: "wide 24mm", move: "slow aerial reveal" },
  introduction: { shot: "wide", lens: "wide 24mm", move: "gentle pan" },
  dialogue: { shot: "medium", lens: "portrait 50mm", move: "static with subtle handheld" },
  emotional: { shot: "close-up", lens: "portrait 50mm", move: "slow push-in" },
  action: { shot: "tracking", lens: "standard 35mm", move: "dynamic tracking" },
  discovery: { shot: "push-in", lens: "standard 35mm", move: "slow push-in" },
  transition: { shot: "medium", lens: "standard 35mm", move: "cinematic dolly" },
  climax: { shot: "close-up", lens: "telephoto 85mm", move: "rapid push-in" },
  resolution: { shot: "wide", lens: "standard 35mm", move: "soft pull-out" },
  ending: { shot: "reveal", lens: "wide 24mm", move: "wide reveal, slow pull-out" },
};

/** Vary consecutive shots to avoid repetition. */
export function varyShot(
  planned: CameraShot,
  prev: CameraShot | undefined,
): CameraShot {
  if (!prev || prev !== planned) return planned;
  const alt: Record<CameraShot, CameraShot> = {
    establishing: "wide",
    wide: "medium",
    medium: "over-the-shoulder",
    "close-up": "medium",
    "extreme close-up": "close-up",
    "over-the-shoulder": "two-shot",
    "two-shot": "medium",
    tracking: "dolly",
    dolly: "push-in",
    "push-in": "medium",
    "pull-out": "wide",
    reveal: "wide",
  };
  return alt[planned] ?? "medium";
}

// ---------- Motion Director ----------

const AMBIENT_MOTION = [
  "floating leaves",
  "moving clouds",
  "soft breeze",
  "tree sway",
  "water ripple",
  "sunlight rays",
  "dust particles",
  "hair movement",
  "cloth movement",
];

const CHARACTER_MOTION = ["blinking eyes", "gentle breathing", "subtle head turn"];

/** Pick 2–4 subtle motion cues appropriate to scene text. */
export function pickMotionCues(text: string, timeOfDay: string, weather: string): string[] {
  const t = (text ?? "").toLowerCase();
  const cues: string[] = [];
  cues.push(...CHARACTER_MOTION);
  if (/forest|tree|leaves|garden|park/.test(t)) cues.push("floating leaves", "tree sway");
  if (/river|water|lake|sea|ocean|rain/.test(t)) cues.push("water ripple");
  if (/sun|morning|day|light/.test(t) || timeOfDay === "day") cues.push("sunlight rays");
  if (/wind|storm|breeze/.test(t) || weather === "windy") cues.push("cloth movement", "hair movement");
  if (/dust|desert|old room|attic/.test(t)) cues.push("dust particles");
  if (cues.length < 3) cues.push(...AMBIENT_MOTION.slice(0, 3));
  return Array.from(new Set(cues)).slice(0, 5);
}

// ---------- Shot plan builder ----------

export function buildShotPlan(args: {
  sceneId: string;
  sceneNumber: number;
  total: number;
  text: string;
  direction?: Partial<SceneDirection>;
  prevShot?: CameraShot;
}): CinematicShotPlan {
  const role = detectSceneRole(args.sceneNumber - 1, args.total, args.text);
  const base = ROLE_SHOT[role];
  const shot = varyShot(base.shot, args.prevShot);
  const d = args.direction ?? {};
  const timeOfDay = d.timeOfDay ?? "day";
  const weather = d.weather ?? "clear";
  return {
    sceneId: args.sceneId,
    sceneNumber: args.sceneNumber,
    role,
    sceneGoal: sceneGoalFor(role, args.text),
    emotionalIntent: d.emotion ?? emotionForRole(role),
    cameraShot: shot,
    cameraAngle: d.cameraAngle ?? "eye-level",
    cameraLens: base.lens,
    cameraMovement: d.cameraMovement ?? base.move,
    characterBlocking: blockingFor(role),
    facialExpression: expressionForRole(role),
    bodyLanguage: bodyLanguageForRole(role),
    lightingStyle: d.lighting ?? "soft global illumination",
    timeOfDay,
    weather,
    backgroundMood: backgroundMoodFor(role, d.colorPalette),
    colorPalette: d.colorPalette ?? "warm cinematic pastels",
    transition: transitionForRole(role, d.transition),
    motionInstructions: pickMotionCues(args.text, timeOfDay, weather),
    soundDesignNotes: soundDesignFor(role, d.musicMood),
  };
}

function sceneGoalFor(role: SceneRole, text: string): string {
  const t = text.trim().split(/[.!?]/)[0]?.slice(0, 120) ?? "";
  const goals: Record<SceneRole, string> = {
    opening: `Establish setting: ${t}`,
    introduction: `Introduce character/world: ${t}`,
    dialogue: `Convey dialogue: ${t}`,
    emotional: `Deepen emotional beat: ${t}`,
    action: `Advance action: ${t}`,
    discovery: `Reveal discovery: ${t}`,
    transition: `Bridge scene: ${t}`,
    climax: `Peak dramatic moment: ${t}`,
    resolution: `Resolve tension: ${t}`,
    ending: `Close story: ${t}`,
  };
  return goals[role];
}

function emotionForRole(r: SceneRole): string {
  return { opening: "wonder", introduction: "curious", dialogue: "engaged", emotional: "tender",
    action: "urgent", discovery: "awe", transition: "reflective", climax: "intense",
    resolution: "relieved", ending: "warm" }[r];
}
function expressionForRole(r: SceneRole): string {
  return { opening: "gentle wonder", introduction: "curious eyes", dialogue: "expressive lips",
    emotional: "soft eyes, slight smile", action: "focused determination", discovery: "wide-eyed surprise",
    transition: "neutral thoughtful", climax: "intense focus", resolution: "relieved smile",
    ending: "warm smile" }[r];
}
function bodyLanguageForRole(r: SceneRole): string {
  return { opening: "relaxed posture", introduction: "open stance", dialogue: "gestural conversation",
    emotional: "leaning in", action: "dynamic motion", discovery: "leaning forward",
    transition: "walking with purpose", climax: "tense stance", resolution: "relaxed shoulders",
    ending: "peaceful posture" }[r];
}
function blockingFor(r: SceneRole): string {
  return { opening: "character small in frame, environment dominant",
    introduction: "character centered, mid-frame",
    dialogue: "two-shot facing each other, rule of thirds",
    emotional: "character off-center, negative space",
    action: "character in motion across frame",
    discovery: "character back to camera, subject beyond",
    transition: "character crossing frame",
    climax: "character centered, low angle",
    resolution: "characters together, balanced composition",
    ending: "character silhouette against horizon" }[r];
}
function backgroundMoodFor(r: SceneRole, palette?: string): string {
  const base = palette ?? "warm";
  return `${base} background, ${{
    opening: "expansive and inviting", introduction: "grounded and warm",
    dialogue: "softly blurred bokeh", emotional: "muted and intimate",
    action: "dynamic streaks", discovery: "misty and mysterious",
    transition: "cinematic haze", climax: "high contrast",
    resolution: "golden and peaceful", ending: "dreamy horizon",
  }[r]}`;
}
function transitionForRole(r: SceneRole, hint?: string): CinematicShotPlan["transition"] {
  const allowed: CinematicShotPlan["transition"][] = ["cut", "fade", "crossfade", "dissolve", "slide", "match cut"];
  if (hint && (allowed as string[]).includes(hint)) return hint as CinematicShotPlan["transition"];
  return ({ opening: "fade", introduction: "cut", dialogue: "cut", emotional: "crossfade",
    action: "cut", discovery: "dissolve", transition: "crossfade", climax: "match cut",
    resolution: "crossfade", ending: "fade" } as const)[r];
}
function soundDesignFor(r: SceneRole, mood?: string): string {
  const m = mood ?? "score";
  const base: Record<SceneRole, string> = {
    opening: `soft ambient ${m}, distant wind, birds`,
    introduction: `warm ${m}, gentle room tone`,
    dialogue: `intimate ${m} bed, clear diegetic sound`,
    emotional: `sparse piano ${m}, breath, heartbeat`,
    action: `driving ${m}, sharp foley`,
    discovery: `swelling ${m}, rising strings`,
    transition: `whooshes, ${m} bridge`,
    climax: `full ${m}, percussive hits`,
    resolution: `warm strings ${m}, exhale`,
    ending: `gentle fade of ${m}, ambient tail`,
  };
  return base[r];
}

// ---------- Prompt enrichment ----------

export const QUALITY_TAGS = [
  "Pixar-quality",
  "Disney-inspired family animation",
  "high-detail children's illustration",
  "soft global illumination",
  "volumetric lighting",
  "natural depth of field",
  "professional cinematic composition",
  "high-quality animation",
];

/** Enrich a base scene prompt (video) with cinematic direction, motion, and quality tags. */
export function enrichVideoPrompt(basePrompt: string, plan?: CinematicShotPlan | null): string {
  if (!plan) {
    return `${basePrompt}\n\nStyle: ${QUALITY_TAGS.slice(0, 5).join(", ")}.`;
  }
  const cinematic = [
    `${plan.cameraShot} shot, ${plan.cameraAngle}, ${plan.cameraLens}`,
    `camera: ${plan.cameraMovement}`,
    `lighting: ${plan.lightingStyle}, ${plan.timeOfDay}, ${plan.weather}`,
    `mood: ${plan.emotionalIntent}`,
    `palette: ${plan.colorPalette}`,
    `blocking: ${plan.characterBlocking}`,
    `motion: ${plan.motionInstructions.join(", ")}`,
  ].join(" · ");
  return `${basePrompt}\n\nDirector: ${cinematic}.\nStyle: ${QUALITY_TAGS.join(", ")}.`;
}

/** Enrich a base image prompt with lighter cinematic tags (no motion). */
export function enrichImagePrompt(basePrompt: string, plan?: CinematicShotPlan | null): string {
  if (!plan) return `${basePrompt}\n\nStyle: ${QUALITY_TAGS.slice(0, 4).join(", ")}.`;
  const bits = [
    `${plan.cameraShot} shot, ${plan.cameraAngle}, ${plan.cameraLens}`,
    `${plan.lightingStyle}, ${plan.timeOfDay}, ${plan.weather}`,
    `${plan.emotionalIntent} mood, ${plan.colorPalette}`,
    plan.characterBlocking,
  ].join(" · ");
  return `${basePrompt}\n\nDirector: ${bits}.\nStyle: ${QUALITY_TAGS.slice(0, 6).join(", ")}.`;
}
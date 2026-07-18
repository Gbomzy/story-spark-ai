// Scene Plan — the single source of truth for every downstream asset.
//
// Once a Scene Plan is generated from the story, narration, storyboard,
// image prompts, video prompts, subtitles and the final render all read
// from the same structured object. No AI stage is allowed to invent,
// rewrite or contradict a scene action after the plan exists.
//
// This module is client-safe: pure types + deterministic helpers. All
// AI calls live in `scenePlan.functions.ts`.

export type PlannedCharacter = {
  id: string;
  name: string;
  role?: string;
  age?: string;
  appearance: string; // hair, eyes, skin, build, distinctive features
  clothing: string; // full outfit description, reused every scene
  personality?: string;
  voice?: string; // TTS voice hint
};

export type PlannedEnvironment = {
  id: string;
  name: string;
  description: string; // long-form: layout, colors, key props
  lighting: string;
  weather?: string;
  timeOfDay?: string;
  ambientSound?: string;
};

export type PlannedScene = {
  sceneNumber: number;
  title: string;
  action: string; // concrete, visible action — the ground truth
  characterIds: string[]; // references PlannedCharacter.id
  characterEmotions: Record<string, string>; // characterId -> emotion
  characterPositions: Record<string, string>; // characterId -> where in frame / stance
  environmentId: string;
  timeOfDay: string;
  weather?: string;
  props: string[];
  cameraShot: string; // "wide", "close-up", "tracking", "over-the-shoulder", ...
  cameraMovement: string; // "static", "slow push-in", "pan left", ...
  narration: string; // narrator VO for the scene
  dialogue: Array<{ characterId: string; line: string; delivery?: string }>;
  durationSeconds: number;
  transitionOut: "cut" | "fade" | "crossfade" | "dissolve" | "slide" | "match cut";
};

export type ScenePlan = {
  version: 2;
  title: string;
  logline?: string;
  ageGroup?: string;
  artStyle?: string;
  characters: PlannedCharacter[];
  environments: PlannedEnvironment[];
  scenes: PlannedScene[];
  createdAt: string;
};

// ---------- Parsing ----------

export function parseScenePlan(raw: unknown): ScenePlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.scenes) || (r.scenes as unknown[]).length === 0) return null;
  const characters = Array.isArray(r.characters)
    ? (r.characters as Record<string, unknown>[]).map((c, i) => ({
        id: String(c.id ?? `char-${i + 1}`),
        name: String(c.name ?? `Character ${i + 1}`),
        role: c.role ? String(c.role) : undefined,
        age: c.age ? String(c.age) : undefined,
        appearance: String(c.appearance ?? ""),
        clothing: String(c.clothing ?? ""),
        personality: c.personality ? String(c.personality) : undefined,
        voice: c.voice ? String(c.voice) : undefined,
      }))
    : [];
  const environments = Array.isArray(r.environments)
    ? (r.environments as Record<string, unknown>[]).map((e, i) => ({
        id: String(e.id ?? `env-${i + 1}`),
        name: String(e.name ?? `Location ${i + 1}`),
        description: String(e.description ?? ""),
        lighting: String(e.lighting ?? ""),
        weather: e.weather ? String(e.weather) : undefined,
        timeOfDay: e.timeOfDay ? String(e.timeOfDay) : undefined,
        ambientSound: e.ambientSound ? String(e.ambientSound) : undefined,
      }))
    : [];
  const scenes = (r.scenes as Record<string, unknown>[]).map((s, i) => {
    const dialogueRaw = Array.isArray(s.dialogue) ? (s.dialogue as unknown[]) : [];
    return {
      sceneNumber: typeof s.sceneNumber === "number" ? s.sceneNumber : i + 1,
      title: String(s.title ?? `Scene ${i + 1}`),
      action: String(s.action ?? ""),
      characterIds: Array.isArray(s.characterIds) ? (s.characterIds as unknown[]).map(String) : [],
      characterEmotions: (s.characterEmotions as Record<string, string>) ?? {},
      characterPositions: (s.characterPositions as Record<string, string>) ?? {},
      environmentId: String(s.environmentId ?? environments[0]?.id ?? "env-1"),
      timeOfDay: String(s.timeOfDay ?? ""),
      weather: s.weather ? String(s.weather) : undefined,
      props: Array.isArray(s.props) ? (s.props as unknown[]).map(String) : [],
      cameraShot: String(s.cameraShot ?? "medium"),
      cameraMovement: String(s.cameraMovement ?? "static"),
      narration: String(s.narration ?? ""),
      dialogue: dialogueRaw.map((d) => {
        const o = (d ?? {}) as Record<string, unknown>;
        return {
          characterId: String(o.characterId ?? ""),
          line: String(o.line ?? ""),
          delivery: o.delivery ? String(o.delivery) : undefined,
        };
      }).filter((d) => d.line),
      durationSeconds: Math.max(2, Math.min(30, Number(s.durationSeconds ?? 6))),
      transitionOut: (["cut", "fade", "crossfade", "dissolve", "slide", "match cut"].includes(String(s.transitionOut))
        ? String(s.transitionOut)
        : "cut") as PlannedScene["transitionOut"],
    };
  });
  return {
    version: 2,
    title: String(r.title ?? "Untitled"),
    logline: r.logline ? String(r.logline) : undefined,
    ageGroup: r.ageGroup ? String(r.ageGroup) : undefined,
    artStyle: r.artStyle ? String(r.artStyle) : undefined,
    characters,
    environments,
    scenes,
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
  };
}

// ---------- Derivations (ground truth → every downstream artefact) ----------

function characterVisualClause(plan: ScenePlan, ids: string[]): string {
  const bits: string[] = [];
  for (const id of ids) {
    const c = plan.characters.find((x) => x.id === id);
    if (!c) continue;
    bits.push(
      `${c.name} (${c.age ? c.age + ", " : ""}${c.appearance}${c.clothing ? "; wearing " + c.clothing : ""})`,
    );
  }
  return bits.join(". ");
}

function environmentClause(plan: ScenePlan, envId: string): string {
  const env = plan.environments.find((e) => e.id === envId);
  if (!env) return "";
  const bits = [env.name, env.description, env.lighting];
  if (env.weather) bits.push(env.weather);
  return bits.filter(Boolean).join(", ");
}

/** Build the image prompt for a scene using the FULL character + environment profile. */
export function buildScenePrompt(plan: ScenePlan, scene: PlannedScene): string {
  const chars = characterVisualClause(plan, scene.characterIds);
  const env = environmentClause(plan, scene.environmentId);
  const emotions = Object.entries(scene.characterEmotions)
    .map(([cid, e]) => {
      const c = plan.characters.find((x) => x.id === cid);
      return c ? `${c.name}: ${e}` : "";
    })
    .filter(Boolean)
    .join("; ");
  const positions = Object.entries(scene.characterPositions)
    .map(([cid, p]) => {
      const c = plan.characters.find((x) => x.id === cid);
      return c ? `${c.name} ${p}` : "";
    })
    .filter(Boolean)
    .join("; ");
  const parts = [
    `Scene ${scene.sceneNumber} — ${scene.title}.`,
    `Action: ${scene.action}`,
    chars ? `Characters: ${chars}` : "",
    emotions ? `Emotions: ${emotions}` : "",
    positions ? `Positions: ${positions}` : "",
    env ? `Location: ${env}` : "",
    scene.timeOfDay ? `Time: ${scene.timeOfDay}` : "",
    scene.props.length ? `Props: ${scene.props.join(", ")}` : "",
    `Camera: ${scene.cameraShot}, ${scene.cameraMovement}`,
    plan.artStyle ? `Style: ${plan.artStyle}` : "",
  ];
  return parts.filter(Boolean).join(". ");
}

/** Video prompt — same ground truth as the image, plus motion cues. */
export function buildSceneVideoPrompt(plan: ScenePlan, scene: PlannedScene): string {
  return `${buildScenePrompt(plan, scene)}. Motion follows narration: "${scene.narration}". Camera performs: ${scene.cameraMovement}.`;
}

/** Narration script — narrator VO + dialogue in order, ready for TTS. */
export function scenePlanToVoiceScript(plan: ScenePlan): string {
  const lines: string[] = [];
  for (const s of plan.scenes) {
    if (s.narration.trim()) lines.push(`[NARRATOR] ${s.narration.trim()}`);
    for (const d of s.dialogue) {
      const c = plan.characters.find((x) => x.id === d.characterId);
      const name = (c?.name ?? "SPEAKER").toUpperCase();
      const cue = d.delivery ? ` (${d.delivery})` : "";
      lines.push(`[${name}]${cue} ${d.line}`);
    }
  }
  return lines.join("\n\n");
}

/** Storyboard markdown — derived from the plan so the Storyboard page stays in sync. */
export function scenePlanToStoryboard(plan: ScenePlan): string {
  return plan.scenes
    .map((s) => {
      const chars = s.characterIds
        .map((id) => plan.characters.find((c) => c.id === id)?.name ?? id)
        .join(", ");
      const env = plan.environments.find((e) => e.id === s.environmentId);
      const dialogue = s.dialogue.map((d) => {
        const c = plan.characters.find((x) => x.id === d.characterId);
        return `"${d.line}" — ${c?.name ?? "Speaker"}`;
      }).join(" / ");
      return [
        `## Scene ${s.sceneNumber} — ${s.title}`,
        `- Setting: ${env?.name ?? ""}, ${s.timeOfDay}${s.weather ? `, ${s.weather}` : ""}`,
        `- Characters: ${chars}`,
        `- Action: ${s.action}`,
        `- Shot: ${s.cameraShot}, ${s.cameraMovement}`,
        `- Dialogue/VO: ${dialogue || `"${s.narration.slice(0, 120)}"`}`,
        `- Transition: ${s.transitionOut}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** JSON array consumed by the pipeline engine's `parseScenes`. */
export function scenePlanToImagesJson(plan: ScenePlan): Array<{
  id: string;
  prompt: string;
  narration: string;
  videoPrompt: string;
  durationSeconds: number;
}> {
  return plan.scenes.map((s) => ({
    id: `scene-${s.sceneNumber}`,
    prompt: buildScenePrompt(plan, s),
    narration: s.narration,
    videoPrompt: buildSceneVideoPrompt(plan, s),
    durationSeconds: s.durationSeconds,
  }));
}

// ---------- Validation ----------

function keywordSet(text: string): Set<string> {
  const STOP = new Set([
    "the","a","an","and","or","but","of","to","in","on","at","for","with","by",
    "is","are","was","were","be","been","being","he","she","it","they","them",
    "his","her","their","this","that","these","those","as","from","into","up",
    "down","out","over","under","then","so","if","when","while","because",
  ]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

export type ScenePlanIssue = {
  sceneNumber: number;
  kind: "narration_action_mismatch" | "missing_narration" | "missing_action" | "unknown_character" | "unknown_environment";
  message: string;
};

export function validateScenePlan(plan: ScenePlan): { ok: boolean; issues: ScenePlanIssue[] } {
  const issues: ScenePlanIssue[] = [];
  const charIds = new Set(plan.characters.map((c) => c.id));
  const envIds = new Set(plan.environments.map((e) => e.id));
  for (const s of plan.scenes) {
    if (!s.narration.trim()) {
      issues.push({ sceneNumber: s.sceneNumber, kind: "missing_narration", message: "Scene has no narration." });
    }
    if (!s.action.trim()) {
      issues.push({ sceneNumber: s.sceneNumber, kind: "missing_action", message: "Scene has no action." });
    }
    for (const cid of s.characterIds) {
      if (!charIds.has(cid)) {
        issues.push({ sceneNumber: s.sceneNumber, kind: "unknown_character", message: `Character ${cid} not in profile list.` });
      }
    }
    if (!envIds.has(s.environmentId)) {
      issues.push({ sceneNumber: s.sceneNumber, kind: "unknown_environment", message: `Environment ${s.environmentId} not in profile list.` });
    }
    if (s.narration && s.action) {
      const nk = keywordSet(s.narration);
      const ak = keywordSet(s.action);
      let overlap = 0;
      for (const w of nk) if (ak.has(w)) overlap++;
      // Require at least one shared content word — otherwise the visual
      // action likely does not match what the narrator is saying.
      if (nk.size >= 3 && overlap === 0) {
        issues.push({
          sceneNumber: s.sceneNumber,
          kind: "narration_action_mismatch",
          message: "Narration and visible action share no key words.",
        });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
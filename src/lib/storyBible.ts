// Story Bible — canonical JSON stored on projects.story_bible.
// Every AI stage can reuse this instead of re-deriving character/world context.

export type StoryBibleCharacter = {
  name: string;
  appearance?: string;
  personality?: string;
  voiceStyle?: string;
};

import type { SceneDirection } from "@/lib/aiDirector.functions";
import type { CinematicShotPlan } from "@/lib/cinematicDirector";
import type { CharacterVisualProfile, VisualProfileMap } from "@/lib/characterVisual";
import type { WorldBible } from "@/lib/worldBible";

export type StoryBible = {
  version: 1;
  characters: StoryBibleCharacter[];
  world?: string;
  theme?: string;
  artStyle?: string;
  cameraStyle?: string;
  voiceStyle?: string;
  worldBible?: WorldBible;
  visualProfiles?: VisualProfileMap;
  direction?: Record<string, SceneDirection>;
  shotPlans?: Record<string, CinematicShotPlan>;
  updatedAt: string;
};

export function emptyBible(): StoryBible {
  return {
    version: 1,
    characters: [],
    updatedAt: new Date().toISOString(),
  };
}

export function parseBible(input: unknown): StoryBible | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const chars = Array.isArray(raw.characters)
    ? (raw.characters as Record<string, unknown>[]).map((c) => ({
        name: String(c.name ?? "").trim(),
        appearance: c.appearance ? String(c.appearance) : undefined,
        personality: c.personality ? String(c.personality) : undefined,
        voiceStyle: c.voiceStyle ? String(c.voiceStyle) : undefined,
      })).filter((c) => c.name)
    : [];
  return {
    version: 1,
    characters: chars,
    world: raw.world ? String(raw.world) : undefined,
    theme: raw.theme ? String(raw.theme) : undefined,
    artStyle: raw.artStyle ? String(raw.artStyle) : undefined,
    cameraStyle: raw.cameraStyle ? String(raw.cameraStyle) : undefined,
    voiceStyle: raw.voiceStyle ? String(raw.voiceStyle) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : new Date().toISOString(),
  };
}

export function mergeBible(existing: StoryBible | null, patch: Partial<StoryBible>): StoryBible {
  const base = existing ?? emptyBible();
  return {
    ...base,
    ...patch,
    version: 1,
    characters: patch.characters ?? base.characters,
    updatedAt: new Date().toISOString(),
  };
}

// Compact snippet suitable for injecting as an extra system message /
// prompt prefix into any AI generation stage.
export function bibleToPromptContext(bible: StoryBible | null): string {
  if (!bible) return "";
  const lines: string[] = ["STORY BIBLE (canonical reference — reuse, do not contradict):"];
  if (bible.theme) lines.push(`Theme: ${bible.theme}`);
  if (bible.world) lines.push(`World: ${bible.world}`);
  if (bible.artStyle) lines.push(`Art style: ${bible.artStyle}`);
  if (bible.cameraStyle) lines.push(`Camera style: ${bible.cameraStyle}`);
  if (bible.voiceStyle) lines.push(`Voice style: ${bible.voiceStyle}`);
  if (bible.characters.length) {
    lines.push("Characters:");
    for (const c of bible.characters) {
      const bits = [c.name];
      if (c.appearance) bits.push(`appearance: ${c.appearance}`);
      if (c.personality) bits.push(`personality: ${c.personality}`);
      if (c.voiceStyle) bits.push(`voice: ${c.voiceStyle}`);
      lines.push(`- ${bits.join(" · ")}`);
    }
  }
  return lines.join("\n");
}
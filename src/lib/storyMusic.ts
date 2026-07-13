// Client-safe helpers and shared types for the Story Music Engine.
// The analyzer server function lives in `storyMusicEngine.functions.ts`.

export type BgmMood =
  | "happy"
  | "calm"
  | "bedtime"
  | "adventure"
  | "celebration"
  | "mystery"
  | "emotional"
  | "funny";

export const BGM_MOODS: BgmMood[] = [
  "happy",
  "calm",
  "bedtime",
  "adventure",
  "celebration",
  "mystery",
  "emotional",
  "funny",
];

export type SfxKind =
  | "birds"
  | "forest"
  | "rain"
  | "ocean"
  | "wind"
  | "footsteps"
  | "door"
  | "school"
  | "crowd"
  | "magic"
  | "celebration";

export const SFX_KINDS: SfxKind[] = [
  "birds",
  "forest",
  "rain",
  "ocean",
  "wind",
  "footsteps",
  "door",
  "school",
  "crowd",
  "magic",
  "celebration",
];

export type SongPosition = "none" | "intro" | "middle" | "ending" | "multiple";

export type MusicMode = "story_only" | "story_ending" | "musical" | "custom";

export const MUSIC_MODES: Array<{
  id: MusicMode;
  label: string;
  description: string;
  forcedPosition?: SongPosition;
  forceSong: boolean;
}> = [
  { id: "story_only", label: "Story Only", description: "Narration + background music. No song.", forcedPosition: "none", forceSong: false },
  { id: "story_ending", label: "Story + Ending Song", description: "One song at the end that reinforces the lesson.", forcedPosition: "ending", forceSong: true },
  { id: "musical", label: "Musical Story", description: "Multiple songs woven through the story.", forcedPosition: "multiple", forceSong: true },
  { id: "custom", label: "Custom", description: "You choose the song position and mood.", forceSong: false },
];

export type StoryMusicSong = {
  position: Exclude<SongPosition, "none">;
  title: string;
  verses: string[];
  chorus: string;
  bridge?: string;
  estimatedDurationSeconds: number;
  singability: "easy" | "medium" | "hard";
  reinforcesLesson: string;
};

export type StoryMusicScene = {
  sceneNumber: number;
  title: string;
  bgmMood: BgmMood;
  volume: number; // 0..1
  narrationVolume?: number;
  sfx?: Array<{ kind: SfxKind; volume: number }>;
};

export type StoryMusicPlan = {
  version: 1;
  mode: MusicMode;
  analysis: {
    theme: string;
    mood: string;
    lesson: string;
    targetAge: string;
    emotionalArc: string;
  };
  recommendation: {
    songNeeded: boolean;
    songPosition: SongPosition;
    reasoning: string;
    backgroundStyle: string;
  };
  scenes: StoryMusicScene[];
  song: StoryMusicSong | null;
  endingCredits?: {
    enabled: boolean;
    fadeOutSeconds: number;
    text?: string;
  };
};

export type StoredSongsField =
  | { kind: "plan"; plan: StoryMusicPlan }
  | { kind: "legacy"; lyrics: string }
  | { kind: "empty" };

/**
 * Parse `projects.songs` (text column). It may hold a JSON-encoded plan
 * (new format) or legacy plain-text lyrics from `generateMediaPack`.
 */
export function parseSongsField(value: string | null | undefined): StoredSongsField {
  if (!value) return { kind: "empty" };
  const trimmed = value.trim();
  if (!trimmed) return { kind: "empty" };
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { version?: number } & Partial<StoryMusicPlan>;
      if (parsed && parsed.version === 1 && parsed.analysis && parsed.recommendation && Array.isArray(parsed.scenes)) {
        return { kind: "plan", plan: parsed as StoryMusicPlan };
      }
    } catch { /* fall through to legacy */ }
  }
  return { kind: "legacy", lyrics: value };
}

export function serializeSongsField(plan: StoryMusicPlan): string {
  return JSON.stringify(plan);
}

export function formatSongText(song: StoryMusicSong): string {
  const lines: string[] = [];
  lines.push(`Title: ${song.title}`);
  lines.push("");
  song.verses.forEach((v, i) => {
    lines.push(`[Verse ${i + 1}]`);
    lines.push(v);
    lines.push("");
    if (i === 0 || i === song.verses.length - 1) {
      lines.push("[Chorus]");
      lines.push(song.chorus);
      lines.push("");
    }
  });
  if (song.bridge) {
    lines.push("[Bridge]");
    lines.push(song.bridge);
    lines.push("");
  }
  lines.push(`Estimated duration: ${Math.round(song.estimatedDurationSeconds)}s`);
  lines.push(`Singability: ${song.singability}`);
  lines.push(`Reinforces lesson: ${song.reinforcesLesson}`);
  return lines.join("\n");
}

export type SceneBgmOverride = { sceneNumber: number; bgmMood: BgmMood; volume: number };

export function parseBackgroundMusic(value: unknown): {
  scenes: SceneBgmOverride[];
  globalTrackUrl?: string;
  globalVolume?: number;
  narrationVolume?: number;
} {
  if (!value || typeof value !== "object") return { scenes: [] };
  const o = value as Record<string, unknown>;
  const scenesRaw = Array.isArray(o.scenes) ? (o.scenes as unknown[]) : [];
  const scenes: SceneBgmOverride[] = scenesRaw
    .map((s) => {
      const so = (s ?? {}) as Record<string, unknown>;
      const num = Number(so.sceneNumber);
      const mood = String(so.bgmMood ?? "calm") as BgmMood;
      const volume = Number(so.volume);
      if (!Number.isFinite(num)) return null;
      return {
        sceneNumber: num,
        bgmMood: (BGM_MOODS as string[]).includes(mood) ? mood : ("calm" as BgmMood),
        volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.2,
      };
    })
    .filter((x): x is SceneBgmOverride => x !== null);
  return {
    scenes,
    globalTrackUrl: typeof o.globalTrackUrl === "string" ? o.globalTrackUrl : undefined,
    globalVolume: typeof o.globalVolume === "number" ? o.globalVolume : undefined,
    narrationVolume: typeof o.narrationVolume === "number" ? o.narrationVolume : undefined,
  };
}
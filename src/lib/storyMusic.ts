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
  {
    id: "story_only",
    label: "Story Only",
    description: "Narration + background music. No song.",
    forcedPosition: "none",
    forceSong: false,
  },
  {
    id: "story_ending",
    label: "Story + Ending Song",
    description: "One song at the end that reinforces the lesson.",
    forcedPosition: "ending",
    forceSong: true,
  },
  {
    id: "musical",
    label: "Musical Story",
    description: "Multiple songs woven through the story.",
    forcedPosition: "multiple",
    forceSong: true,
  },
  {
    id: "custom",
    label: "Custom",
    description: "You choose the song position and mood.",
    forceSong: false,
  },
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
      if (
        parsed &&
        parsed.version === 1 &&
        parsed.analysis &&
        parsed.recommendation &&
        Array.isArray(parsed.scenes)
      ) {
        return { kind: "plan", plan: parsed as StoryMusicPlan };
      }
    } catch {
      /* fall through to legacy */
    }
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

// ---------------- Audio Studio (v2) ----------------

export type SfxItem = {
  id: string;
  kind: SfxKind;
  url?: string;
  volume: number; // 0..1
  startOffset?: number; // seconds from scene start
};

export type AudioStudioScene = {
  sceneNumber: number;
  title?: string;
  bgmMood: BgmMood;
  bgmTrackUrl?: string;
  musicVolume: number; // 0..1
  narrationVolume: number; // 0..1
  sfx: SfxItem[];
};

export type EndingCreditsConfig = {
  enabled: boolean;
  trackUrl?: string;
  fadeOutSeconds: number;
  text?: string;
};

export type DuckingConfig = {
  enabled: boolean;
  duckedLevel: number; // 0..1 — target while narration is speaking
  attackMs: number;
  releaseMs: number;
  threshold: number; // 0..1 RMS threshold
};

export type AudioStudioState = {
  version: 2;
  scenes: AudioStudioScene[];
  endingCredits: EndingCreditsConfig;
  ducking: DuckingConfig;
  globalTrackUrl?: string;
};

export const DEFAULT_DUCKING: DuckingConfig = {
  enabled: true,
  duckedLevel: 0.15,
  attackMs: 120,
  releaseMs: 400,
  threshold: 0.05,
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Parse `projects.background_music` (jsonb) into the v2 Audio Studio shape.
 * Migrates the legacy `{scenes:[{sceneNumber,bgmMood,volume}]}` shape.
 */
export function parseAudioStudio(value: unknown, planScenes?: StoryMusicScene[]): AudioStudioState {
  const base: AudioStudioState = {
    version: 2,
    scenes: [],
    endingCredits: { enabled: false, fadeOutSeconds: 3 },
    ducking: { ...DEFAULT_DUCKING },
  };
  const src = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  if (src.version === 2 && Array.isArray(src.scenes)) {
    base.scenes = (src.scenes as unknown[]).map((s, i) => normalizeStudioScene(s, i));
  } else if (Array.isArray(src.scenes)) {
    // legacy v1
    base.scenes = (src.scenes as unknown[]).map((s, i) => normalizeStudioScene(s, i));
  } else if (planScenes && planScenes.length) {
    base.scenes = planScenes.map((s) => ({
      sceneNumber: s.sceneNumber,
      title: s.title,
      bgmMood: s.bgmMood,
      musicVolume: s.volume,
      narrationVolume: s.narrationVolume ?? 1,
      sfx: (s.sfx ?? []).map((x) => ({ id: genId(), kind: x.kind, volume: x.volume })),
    }));
  }

  // Merge in plan scene metadata (title, sfx recommendations) when missing.
  if (planScenes) {
    for (const ps of planScenes) {
      const existing = base.scenes.find((s) => s.sceneNumber === ps.sceneNumber);
      if (!existing) {
        base.scenes.push({
          sceneNumber: ps.sceneNumber,
          title: ps.title,
          bgmMood: ps.bgmMood,
          musicVolume: ps.volume,
          narrationVolume: ps.narrationVolume ?? 1,
          sfx: (ps.sfx ?? []).map((x) => ({ id: genId(), kind: x.kind, volume: x.volume })),
        });
      } else {
        if (!existing.title) existing.title = ps.title;
        if (!existing.sfx.length && ps.sfx?.length) {
          existing.sfx = ps.sfx.map((x) => ({ id: genId(), kind: x.kind, volume: x.volume }));
        }
      }
    }
    base.scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  }

  const ec =
    src.endingCredits && typeof src.endingCredits === "object"
      ? (src.endingCredits as Record<string, unknown>)
      : null;
  if (ec) {
    base.endingCredits = {
      enabled: Boolean(ec.enabled),
      trackUrl: typeof ec.trackUrl === "string" ? ec.trackUrl : undefined,
      fadeOutSeconds: typeof ec.fadeOutSeconds === "number" ? ec.fadeOutSeconds : 3,
      text: typeof ec.text === "string" ? ec.text : undefined,
    };
  }

  const d =
    src.ducking && typeof src.ducking === "object"
      ? (src.ducking as Record<string, unknown>)
      : null;
  if (d) {
    base.ducking = {
      enabled: d.enabled === undefined ? true : Boolean(d.enabled),
      duckedLevel:
        typeof d.duckedLevel === "number" ? clamp01(d.duckedLevel) : DEFAULT_DUCKING.duckedLevel,
      attackMs: typeof d.attackMs === "number" ? d.attackMs : DEFAULT_DUCKING.attackMs,
      releaseMs: typeof d.releaseMs === "number" ? d.releaseMs : DEFAULT_DUCKING.releaseMs,
      threshold: typeof d.threshold === "number" ? clamp01(d.threshold) : DEFAULT_DUCKING.threshold,
    };
  }

  if (typeof src.globalTrackUrl === "string") base.globalTrackUrl = src.globalTrackUrl;
  return base;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeStudioScene(raw: unknown, i: number): AudioStudioScene {
  const s = (raw ?? {}) as Record<string, unknown>;
  const mood = String(s.bgmMood ?? "calm");
  const bgmMood = (BGM_MOODS as string[]).includes(mood) ? (mood as BgmMood) : "calm";
  const musicVol =
    typeof s.musicVolume === "number"
      ? clamp01(s.musicVolume)
      : typeof s.volume === "number"
        ? clamp01(s.volume as number)
        : 0.2;
  const narrVol = typeof s.narrationVolume === "number" ? clamp01(s.narrationVolume) : 1;
  const rawSfx = Array.isArray(s.sfx) ? (s.sfx as unknown[]) : [];
  const sfx: SfxItem[] = rawSfx.map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const kind = String(o.kind ?? "birds");
    return {
      id: typeof o.id === "string" ? o.id : genId(),
      kind: (SFX_KINDS as string[]).includes(kind) ? (kind as SfxKind) : "birds",
      url: typeof o.url === "string" ? o.url : undefined,
      volume: typeof o.volume === "number" ? clamp01(o.volume) : 0.6,
      startOffset: typeof o.startOffset === "number" ? o.startOffset : undefined,
    };
  });
  return {
    sceneNumber: Number.isFinite(Number(s.sceneNumber)) ? Number(s.sceneNumber) : i + 1,
    title: typeof s.title === "string" ? s.title : undefined,
    bgmMood,
    bgmTrackUrl: typeof s.bgmTrackUrl === "string" ? s.bgmTrackUrl : undefined,
    musicVolume: musicVol,
    narrationVolume: narrVol,
    sfx,
  };
}

export function serializeAudioStudio(state: AudioStudioState): Record<string, unknown> {
  return {
    version: 2,
    scenes: state.scenes,
    endingCredits: state.endingCredits,
    ducking: state.ducking,
    globalTrackUrl: state.globalTrackUrl,
  };
}

export function newSfxItem(kind: SfxKind): SfxItem {
  return { id: genId(), kind, volume: 0.6 };
}

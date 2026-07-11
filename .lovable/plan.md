# Story Music Engine

Turn the current Songs page into an intelligent, opt-in music engine that analyzes the story, decides whether/where a song fits, and generates per-scene background-music recommendations that the Movie Composer can mix under narration. Keeps existing lyric generation, providers, billing, and pipeline intact.

## 1. New server function: `analyzeStoryMusic`

File: `src/lib/storyMusicEngine.functions.ts` (new)

Auth-protected `createServerFn` calling Qwen with a strict JSON-only prompt. Input: `{ prompt, story, ageGroup?, language? }`. Output shape:

```ts
type StoryMusicPlan = {
  analysis: { theme: string; mood: string; lesson: string; targetAge: string; emotionalArc: string };
  recommendation: {
    songNeeded: boolean;
    songPosition: "none" | "intro" | "middle" | "ending" | "multiple";
    reasoning: string;
    backgroundStyle: string; // e.g. "warm acoustic, gentle strings"
  };
  scenes: Array<{
    sceneNumber: number;
    title: string;
    bgmMood: "happy" | "calm" | "bedtime" | "adventure" | "celebration" | "mystery" | "emotional" | "funny";
    volume: number; // 0..1 recommended duck level under narration
  }>;
  song?: {
    position: "intro" | "middle" | "ending" | "multiple";
    title: string;
    verses: string[];
    chorus: string;
    bridge?: string;
    estimatedDurationSeconds: number;
    singability: "easy" | "medium" | "hard";
    reinforcesLesson: string;
  } | null;
};
```

Uses `beginCharge`/`commit`/`refund` (operation: `story`, units: 2) mirroring `generateMediaPack`. Robust JSON parse: strip ```json fences, then `JSON.parse`.

## 2. Story Music Modes

Add a mode selector on the Songs page. Modes map to what the engine produces/persists:

- **Story Only** (default): analysis + scene BGM; no song.
- **Story + Ending Song**: force `songPosition: "ending"`, force `songNeeded: true`.
- **Musical Story**: force `songPosition: "multiple"` (intro + ending minimum).
- **Custom**: user picks position (intro / middle / ending / multiple / none) and optionally overrides mood.

Mode + overrides are sent to the analyzer so Qwen respects them.

## 3. Songs page redesign — `src/routes/_app.songs.tsx`

Rewrite around the plan output. Sections:

1. **Mode picker** — 4 cards (Story Only / +Ending / Musical / Custom) + Custom position select.
2. **Analyze button** — runs `analyzeStoryMusic`; disabled without a saved story.
3. **Analysis card** — theme, mood, lesson, target age, emotional arc, recommended background style, recommendation reasoning, "song recommended: yes/no + position".
4. **Song card** — only if plan has a song: title, verses, chorus, optional bridge, duration, singability, lesson-reinforcement note. Copy / download TXT. "Music synthesis unavailable" note stays.
5. **Scene BGM card** — table of scenes with mood chip + volume slider (0..100%). Editable, persisted.

Persistence: store the whole plan as JSON in `projects.songs` (existing text column), and the per-scene BGM array in `projects.background_music` (existing jsonb column). Also store mode/overrides inside `songs` JSON. Read via `JSON.parse` with fallback: if `project.songs` isn't JSON, treat as legacy lyric text and show it read-only with an "Upgrade to Story Music" button that runs the analyzer.

## 4. Movie Composer BGM mixing

`src/lib/movieComposer.ts`:

- Extend `ComposerSettings` with `backgroundMusic?: { url: string; volume: number; loop?: boolean }` and `narrationVolume?: number` (default 1.0).
- In `composeMovie`, when `backgroundMusic.url` is set, load a second `HTMLAudioElement`, route through a WebAudio `GainNode` (volume from setting, default ~0.2 to duck under narration), connect to the same `MediaStreamDestination`. Loop if track shorter than movie.
- Preserve existing narration path; both streams mix into the recorder.

`src/routes/_app.movie-composer.tsx`:

- New "Background music" mini-panel in `SettingsPanel`: URL input (or "use per-scene plan"), volume slider, narration volume slider. Wire into `settings` state → `composeMovie`.
- If `project.background_music` has a global track URL, prefill.

Per-scene mood mixing across clip boundaries is out of scope for this pass — we mix a single BGM track underneath the whole movie with the recommended global style/volume. Scene mood metadata is stored for future per-scene ducking and displayed in the Songs page.

## 5. Wiring & guardrails

- Story generator: keep `generateMediaPack` untouched (still produces `songs` lyrics for legacy). Add a note that Songs page now supersedes it, but do NOT auto-run analyzer.
- Types: extend `types.ts`? No — `projects.songs` (text) and `projects.background_music` (jsonb) already exist. Add local TS types only.
- Billing: single `beginCharge` inside `analyzeStoryMusic`. No changes to other providers.
- Providers file: no changes.
- TypeScript strict: all new code fully typed; no `any`.

## Technical details

Files touched:

- **new** `src/lib/storyMusicEngine.functions.ts` — analyzer server fn + shared types.
- **new** `src/lib/storyMusic.ts` — client-safe parsing/normalization helpers + mode presets.
- **edit** `src/routes/_app.songs.tsx` — full rewrite around the engine.
- **edit** `src/lib/movieComposer.ts` — BGM mixing + narration gain.
- **edit** `src/routes/_app.movie-composer.tsx` — BGM controls in settings panel; pass through to `composeMovie`.

No DB migration. No changes to `pipelineEngine.functions.ts`, `qwen.functions.ts`, billing, providers, or auth. Voice-script sanitization from the previous fix is preserved.

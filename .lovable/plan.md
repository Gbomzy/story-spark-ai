# Audio Studio Plan

Extend the existing Story Music Engine into a per-scene Audio Studio with music preview, sound effects, automatic ducking, ending credits, and Movie Composer integration. No changes to billing, AI providers, publishing, or auth.

## 1. Data model (client-only, no DB migration)

`projects.background_music` (jsonb) becomes the authoritative Audio Studio blob. Backward compatible — existing `scenes[]` field kept.

New shape (all optional so old projects keep working):

```ts
type AudioStudioState = {
  version: 2;
  scenes: Array<{
    sceneNumber: number;
    bgmMood: BgmMood;
    bgmTrackUrl?: string;   // per-scene track override
    musicVolume: number;    // 0..1 (was `volume`)
    narrationVolume: number;// 0..1 default 1
    sfx: Array<{ id: string; kind: SfxKind; url?: string; volume: number; startOffset?: number }>;
  }>;
  endingCredits?: {
    enabled: boolean;
    trackUrl?: string;
    fadeOutSeconds: number;
    text?: string;
  };
  ducking: { enabled: boolean; duckedLevel: number; attackMs: number; releaseMs: number };
  globalTrackUrl?: string;   // legacy fallback
};
```

New helpers in `src/lib/storyMusic.ts`: `parseAudioStudio`, `serializeAudioStudio`, `SFX_KINDS`, migration from v1.

## 2. Server: extend analyzer

`src/lib/storyMusicEngine.functions.ts` — extend the Qwen JSON schema so every scene also returns:
- `narrationVolume` (0..1, default 1)
- `sfx: Array<{ kind: "birds"|"forest"|"rain"|"ocean"|"wind"|"footsteps"|"door"|"school"|"crowd"|"magic"|"celebration"; volume: number }>` — 0-3 items per scene picked from the story

Add `endingCredits` recommendation when `songPosition === "ending"` or mode `story_ending`/`musical`.

No provider or credit changes.

## 3. Songs page → Audio Studio UI

Rewrite `src/routes/_app.songs.tsx` (rename tab label to "Audio Studio", route stays `/songs` for compatibility). Sections:

1. Mode selector (unchanged)
2. Story analysis (unchanged)
3. Song card (unchanged)
4. **Per-scene panel** — for each scene:
   - Mood chip picker
   - Music preview mini-player: Play / Pause / Loop toggle + Replace Track (URL input) + Download
   - Music volume, Narration volume sliders
   - SFX chips (add/remove from recommended kinds) with per-SFX volume + optional URL
5. **Ducking panel** — enable toggle + ducked level + attack/release
6. **Ending Credits panel** — enable + track URL + fade-out seconds + optional text

Preview uses a small client helper `src/lib/audioPreview.ts` (HTMLAudioElement wrapper with loop).

## 4. Movie Composer integration

Extend `src/lib/movieComposer.ts`:
- `ComposerSettings.audioStudio?: AudioStudioState`
- Per-clip build a scheduled `AudioContext` graph: narration source (already mixed) + per-scene BGM (looped, gain-per-scene) + per-scene SFX (one-shots at scene start) + optional ending credits track with linear ramp fade-out.
- **Automatic ducking**: analyze narration via `AnalyserNode` RMS every rAF; when RMS > threshold, ramp BGM gain to `duckedLevel` (attack), else back to scene `musicVolume` (release). Falls back to constant scene volume when `ducking.enabled=false`.
- Scene transitions switch scene index based on the running clip's start/end times.

Update `src/routes/_app.movie-composer.tsx`:
- Replace the single background-music URL panel with an "Audio Studio" summary card showing scene BGM/SFX/ducking counts, plus a "Preview mix" button that plays the assembled audio graph (no video) so users can hear the mix before rendering.
- If a project has `audioStudio`, pass it into `composeMovie(..., { audioStudio })`.

## 5. TypeScript & scope

- No changes to `billing.functions.ts`, `publishing.functions.ts`, `qwen.functions.ts`, `cosyvoice.functions.ts`, providers, auth, DB schema.
- Strict TS across new files; no `any`.
- Legacy v1 `{scenes:[{sceneNumber,bgmMood,volume}]}` auto-migrates on read.

## Files

Created: `src/lib/audioPreview.ts`
Edited:
- `src/lib/storyMusic.ts` (v2 types, migrator, SFX enum)
- `src/lib/storyMusicEngine.functions.ts` (extend schema/prompt/normalizer)
- `src/routes/_app.songs.tsx` (Audio Studio UI)
- `src/lib/movieComposer.ts` (scheduler + ducking + SFX + credits)
- `src/routes/_app.movie-composer.tsx` (Audio Studio card, wiring)

## Out of scope

- No music synthesis provider (still lyrics + user-supplied URLs).
- No new DB columns; everything fits in `background_music` jsonb.
- No auto-generated SFX audio files — users paste URLs; recommendations are metadata.

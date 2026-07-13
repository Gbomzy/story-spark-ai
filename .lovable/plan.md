# Phase 6 — AI Orchestrator, Director, Producer & First-Time UX

Additive only. No changes to auth, billing, credits, publishing, AI providers, Movie Composer internals, or existing generators.

## 1. Master Orchestrator (`src/lib/orchestrator.functions.ts`)

New `runOrchestrator` server fn (`createServerFn` + `requireSupabaseAuth`). Executes stages in dependency order, each stage isolated and resume-safe.

Stage list stored on `projects.orchestrator_state` (new jsonb column):

```
{
  status: "idle" | "running" | "paused" | "completed" | "failed",
  currentStage: string,
  stages: { [stageId]: { state: "pending"|"running"|"completed"|"failed"|"skipped", startedAt, completedAt, creditsUsed, error? } },
  progress: number,
  creditsUsed: number,
  eta: number,
  currentScene?, currentClip?,
  retryCount: number
}
```

Stages (dependency edges shown):

```
story → storyBible → characters ↘
                    → storyboard → director → imagePrompts → images ↘
                                                        → voiceScript → voice ↘
                                              → musicAnalysis → music ↘
                                                                       → videos → subtitles → composition → thumbnail
                                                                                                          → seo
```

Independent branches (`characters`, `music`, `seo`) run via `Promise.all` where the graph allows. Sequential branches (voice, video) stay ordered.

Each stage wrapper:
- Skip if already `completed` (smart recovery — reuse existing story/characters/images/voice/videos).
- Call existing generator server fn (reuse Qwen/CosyVoice/Wan pipeline — no rewrites).
- Update `orchestrator_state`, credit ledger (existing `credit_reserve`/`credit_commit`), `generation_history`.
- On error: mark stage `failed`, keep others, allow resume.

Called by the client via a polling loop (`useQuery` refetchInterval 3s) that re-invokes `runOrchestrator` until `status !== "running"`. Worker-timeout safe — each call does one stage or one clip and returns.

## 2. AI Director (`src/lib/aiDirector.functions.ts`)

`analyzeStoryboardDirection` server fn: takes storyboard, calls Qwen chat with a structured JSON schema returning per-scene `{ cameraAngle, cameraDistance, cameraMovement, lighting, weather, timeOfDay, emotion, musicMood, transition, colorPalette }`. Persist into `story_bible.direction[sceneId]`.

`buildScenePrompt(sceneId, basePrompt, bible)` helper merges direction into the prompt so image + video stages consume it. Called from existing `pipelineEngine` prompt-composition step (small edit — prefix the direction line into `prompt`).

## 3. AI Producer (`src/lib/aiProducer.ts`)

Pure client util `estimateProduction(project)`:
- scenes = storyboard.length
- images = scenes; clips = scenes; voiceSec ≈ words/2.5
- credits via existing `creditEstimator` summed per stage
- time = clips × ~30s + voice + images
- storage ≈ clips × 8MB + images × 0.5MB

## 4. One-Click Create Movie UI (`src/routes/_app.create-movie.tsx`)

New primary route "Create Movie". Steps:
1. Prompt textarea + template picker + producer estimate card.
2. Confirm dialog: "Start Production / Cancel".
3. Live orchestrator dashboard: current stage badge, overall progress bar, stage list with per-stage state, current scene/clip, ETA, credits used, Pause / Resume / Cancel buttons.

Pause/Resume set `orchestrator_state.status`. Cancel marks `failed` and stops polling.

Sidebar entry "Create Movie" added at top.

## 5. Orchestrator Dashboard (`src/routes/_app.orchestrator.tsx`)

Read-only view of `orchestrator_state` across all in-progress projects. Columns: project, stage, provider (from ORCHESTRATOR map), credits, ETA, current scene/clip, retry count, queue health (sourced from existing `systemHealth`).

## 6. Onboarding Wizard

New route `src/routes/_app.onboarding.tsx` (6 steps) writing to `profiles.onboarding` jsonb (new column):
`{ completed: true, useCase, artStyle, voice, language, aspectRatio }`.

Root `_app.tsx` reads `profiles.onboarding.completed`; if false, redirects to `/onboarding`. Wizard step 6 creates first project via existing project creation server fn and marks completed.

## 7. Templates (`src/lib/projectTemplates.ts`)

Static array with the 9 templates (Bedtime, Bible, Educational, Moral, Science, History, Nursery, Adventure, Language). Each has `{ id, name, prompt, artStyle, voice, music, transitions, exportSettings }`. Used by Create Movie prompt step and existing project wizard.

## 8. Notifications

Reuse existing `notifications` table + `pushNotification` helper. New kinds: `production_started`, `stage_completed`, `credits_low`, `production_completed`, `production_failed`, `resume_available`. Orchestrator inserts them at stage boundaries.

Browser notifications: on Create Movie mount, `Notification.requestPermission()`. When a poll response flips a stage to completed and page is hidden, fire `new Notification(...)`.

## 9. Data & migration

Single migration:

```sql
alter table public.projects add column if not exists orchestrator_state jsonb;
alter table public.profiles add column if not exists onboarding jsonb default '{"completed":false}'::jsonb;
create index if not exists idx_projects_orch_status on public.projects ((orchestrator_state->>'status'));
```

No grant/RLS changes — both tables already have policies.

## 10. Deliverables

- New: `src/lib/orchestrator.functions.ts`, `src/lib/aiDirector.functions.ts`, `src/lib/aiProducer.ts`, `src/lib/projectTemplates.ts`, `src/routes/_app.create-movie.tsx`, `src/routes/_app.orchestrator.tsx`, `src/routes/_app.onboarding.tsx`, `supabase/migrations/<ts>_orchestrator.sql`.
- Edited: `src/components/app-sidebar.tsx` (nav entries), `src/routes/_app.tsx` (onboarding gate), `src/lib/pipelineEngine.functions.ts` (consume `bible.direction`), `src/integrations/supabase/types.ts` (regenerated by migration tooling).

## 11. Guardrails

- Every new server fn: `requireSupabaseAuth`, Zod input, typed DTO.
- Reuse existing `credit_reserve`/`credit_commit` — no new billing paths.
- Reuse existing generators — orchestrator only sequences them.
- Orchestrator poll = one stage per invocation → Worker-timeout safe & resume-safe by construction.
- `tsgo` clean at completion.

## 12. Out of scope

- New AI providers or models.
- Video editor changes.
- Real-time websockets (polling only).
- Push notifications (browser Notification API only).

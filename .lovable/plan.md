# Production Stabilization Plan

Scope: harden StorySpark AI for production. Seven work items, no experimental features. Preserve billing, publishing, credits, AI providers, and auth. Zero TypeScript errors.

## 1. Surface real save errors everywhere

Create a single helper `src/lib/dbError.ts` that converts a Supabase/PostgREST error into a readable string (message + details + hint + code) and always logs the raw error to console. Replace every `toast.error("Failed to save")` and similar generic catches with this helper.

Files touched:
- `src/routes/_app.project-settings.$id.tsx` — project settings save
- `src/routes/_app.story-generator.tsx` — already partially done, migrate to helper
- `src/routes/_app.movie-composer.tsx` — movie save
- `src/routes/_app.timeline.tsx` — timeline save
- `src/routes/_app.publishing.tsx` — publishing save
- `src/lib/projects.ts` — wrap `updateProject`/`createProject` so callers get rich errors
- Any other `updateProject(...)` call site using a generic toast

Behavior: on failure, toast shows `message — details — hint: X — code: Y` and console logs the full error object. No behavior change on success.

## 2. Story Bible

Canonical JSON stored on `projects.story_bible` (jsonb, nullable) with a versioned schema:

```
StoryBible v1 {
  version: 1,
  characters: [{ name, appearance, personality, voiceStyle }],
  world: string,
  theme: string,
  artStyle: string,
  cameraStyle: string,
  voiceStyle: string,
  updatedAt: string,
}
```

New files:
- `src/lib/storyBible.ts` — types, zod-ish parser, `emptyBible()`, `mergeBible(existing, partial)`, `bibleToPromptContext(bible)` returning a compact system-prompt snippet.
- `src/lib/storyBible.functions.ts` — `getStoryBible({projectId})`, `saveStoryBible({projectId, bible})`, `deriveStoryBible({projectId})` that reads existing story/characters/storyboard and asks Qwen once to synthesize the bible, then persists.

Wiring (minimal, no prompt regressions): every AI stage that currently builds its own context (`generateCharacters`, `generateStoryboard`, `generateMediaPack`, image/voice/video prompt builders in `pipelineEngine.functions.ts` and `qwenImage.functions.ts`) accepts an optional `bibleContext: string` and prepends it to the existing prompt when provided. Story Generator + Storyboard/Video studio load the bible for the active project and pass it. If no bible exists we do not block generation — we fall back to today's behavior.

Migration: add `story_bible jsonb` to `projects`. GRANTs are already in place for `projects`.

## 3. Asset Library

Reuse existing `project_assets` table (already present). Add a unified surface:

- `src/lib/assetLibrary.ts` — `saveAsset({projectId, kind, url, meta})`, `listAssets({projectId?, kind?})`, `deleteAsset(id)`. Kinds: `story | character | storyboard | image | voice | music | video | movie | thumbnail`.
- Hook automatic saves into existing generation success paths: each service (`imageService`, `voiceService`, `musicService`, `videoService`, `thumbnailService`, `movieComposer`) calls `saveAsset` after a successful generation. Idempotent by `(project_id, kind, url)`.
- New route `src/routes/_app.asset-library.tsx` with filter-by-kind grid, copy URL, delete, and "reuse" button that emits a global event so the current tool can pick it up (Storyboard/Video Studio listen).

Migration: add uniqueness index `(project_id, asset_type, url)` on `project_assets` if not present, and confirm GRANTs.

## 4. Owner Analytics dashboard

New route `src/routes/_app.owner-analytics.tsx`, gated by `has_role(uid,'admin')`. Server function `src/lib/ownerAnalytics.functions.ts` (admin-only middleware check inside handler) returns:

- API cost: sum of `credit_transactions.credits` where operation is a provider call, multiplied by configured cost-per-credit.
- Revenue: sum of `credit_purchases.amount_cents` where status=`succeeded`.
- Credits sold: sum of `credit_purchases.credits`.
- Credits consumed: sum of negative `credit_transactions.credits` where `status='completed'`.
- Profit estimate: revenue − API cost.
- Most active users: top 10 by `credit_transactions` volume in the last 30 days, joined to `profiles.display_name`.
- Storage usage: sum of `project_assets.size_bytes` grouped by user (falls back to count when size is null).

## 5. System Health dashboard

Extend existing `_app.system-health.tsx` with a metrics section fed by `src/lib/systemHealth.functions.ts`:

- Queue size: `count(generation_queue where status in ('queued','running'))`.
- Active renders: `count(generation_queue where status='running')`.
- API latency (p50/p95): from `generation_history.duration_ms` last hour.
- Failure rate: `failed / total` last 24h from `generation_history`.
- Average generation time: mean `duration_ms` last 24h.
- Provider health: reuse existing `PROVIDERS` + last-hour success ratio from `generation_history.provider`.

Auto-refresh via TanStack Query `refetchInterval: 15s`.

## 6. Notification Center

New table `notifications`:

```
id uuid pk, user_id uuid, kind text, title text, body text,
project_id uuid null, read_at timestamptz null,
created_at timestamptz default now()
```

With GRANTs + RLS (`user_id = auth.uid()` for select/update; insert via `service_role` from server fns).

Server helpers `src/lib/notifications.functions.ts`:
- `listNotifications`, `markRead`, `markAllRead`.
- `pushNotification({userId, kind, title, body, projectId?})` — invoked from server-side hooks:
  - generation completed / failed (in `pipelineEngine.functions.ts`)
  - publishing completed (`publishing.functions.ts`)
  - credits low (in `credit_reserve` result path when `balance < 20`)
  - subscription renewed (webhook: `paystack-webhook.ts` / `flutterwave-webhook.ts`)

UI:
- `src/components/notification-bell.tsx` in topbar with unread badge + popover list.
- `src/routes/_app.notifications.tsx` full page with filter and mark-all.

Kinds: `generation_complete | generation_failed | publish_complete | credits_low | subscription_renewed`.

## 7. Guardrails

- No changes to `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`, `.env`.
- No provider swaps, no billing formula changes.
- Every new server fn returns typed DTOs; no `any`. `tsgo` must pass.
- Every new `public` table migration includes CREATE → GRANT → ENABLE RLS → CREATE POLICY in that order.

## Delivery order

1. Migration: add `projects.story_bible` + create `notifications` table + `project_assets` unique index.
2. `dbError.ts` + refactor all save call sites (item 1).
3. Story Bible module + wiring (item 2).
4. Asset Library service + route (item 3).
5. Notifications table wiring + bell + page (item 6).
6. Owner Analytics route + server fn (item 4).
7. System Health metrics extension (item 5).
8. Typecheck sweep.

Out of scope: real-time push (in-app polling only), email notifications, new AI providers, UI theme changes.

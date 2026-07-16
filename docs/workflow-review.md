# StorySpark AI — First-Time Workflow Review

_Stabilization phase, Phase 8._

## Primary workflow (canonical)

**Create Movie → Render Queue → Download → Publish.**

Everything a first-time user needs is now reachable from the 6-item
primary sidebar. Advanced Tools (14+ studios) collapse by default and
auto-expand only when the active route lives inside.

## Page-by-page findings

### Dashboard (`/dashboard`)
- ✅ Landing surface for signed-in users.
- Recommendation (future): show the last active render as a resume card
  so users don't need to click into Render Queue to see progress.

### Create Movie (`/create-movie`)
- ✅ This is the single entry point users should be pointed at.
- Overlaps with: Story Generator, Character Creator, Storyboard, Voice
  Studio, Song Studio, Image Prompt Studio, Video Studio, Movie
  Composer, AI Director. All demoted to Advanced Tools this phase.
- Recommendation: after clicking Generate, redirect straight to
  `/render-dashboard` — currently the user has to navigate manually.

### My Projects (`/projects`)
- ✅ Clean list. Keep.
- Recommendation: sort by "last activity" not "created", and pin
  currently-rendering projects to the top.

### Render Queue (`/render-dashboard`)
- ✅ Now a real controller of the durable queue (Pause/Resume/Retry
  route to `render_jobs` transactions).
- ✅ Heartbeat + ETA no longer show `Infinity` / `NaN`.
- ✅ Success/Avg/ETA read "Not enough data" until real samples exist.
- Recommendation: rename UI label from "Live Render" to "Render Queue"
  to match the sidebar.

### Publish (`/publishing`)
- ✅ Clear endpoint after Download. Keep.
- Recommendation: add a "Preview" button that opens the finalised MP4
  in a modal before publishing.

### Billing (`/billing`)
- ✅ Focused. Keep. (Credits page is now under Advanced Tools since it
  duplicates the billing overview.)

## Duplicates flagged (kept but demoted)

| Standalone tool         | Covered inside Create Movie | Action    |
|-------------------------|-----------------------------|-----------|
| Story Generator         | Yes — story step            | Advanced  |
| Character Creator       | Yes — character step        | Advanced  |
| Storyboard              | Yes — storyboard step       | Advanced  |
| Voice Studio            | Yes — voice step            | Advanced  |
| Song Studio             | Yes — soundtrack step       | Advanced  |
| Image Prompt Studio     | Yes — image step            | Advanced  |
| Video Studio            | Yes — video step            | Advanced  |
| Movie Composer          | Yes — final composition     | Advanced  |
| AI Director             | Yes — direction map is auto | Advanced  |
| Cinematic Quality       | Yes — quality preset        | Advanced  |
| Orchestrator            | Redundant with Render Queue | Advanced  |

Nothing was deleted — every route file, API, and story-bible field
remains, so power users keep every existing entry point.

## First-time UX improvements shipped this phase

1. Sidebar collapsed from ~35 items → 6 primary + collapsed Advanced.
2. Render Dashboard controls now work end-to-end.
3. Placeholder statistics (`0%`, `Infinity`, `NaN`) replaced with
   "Not enough data" so no metric is ever misleading.
4. `fmtDuration` guards non-finite values everywhere.
5. Pipeline stage timings now measurable via `perfMetrics` module
   without any AI change.

## Suggested next steps (not part of this phase)

- Onboarding tour that walks: Create Movie → Render Queue → Download →
  Publish, one click each.
- Empty state on Render Queue when there are no projects yet, pointing
  at Create Movie.
- Consolidate `/history`, `/jobs`, `/queue`, `/timeline` into a single
  "Activity" view under Advanced Tools.
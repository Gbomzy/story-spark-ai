Phase 4 is large and every stage depends on real DashScope endpoints. Before I write ~2k lines of provider code, I need to confirm scope and a few facts so nothing regresses and no fictional endpoints ship.

## What I'll build (additive only)

1. **Provider Registry (real).** Extend `src/lib/providers.ts` + a new `src/lib/providerRegistry.ts` with every provider you listed (Qwen‑Max / Plus / Flash / Omni / VL, Qwen Image 2.0, Wan T2I/T2V/I2V/Ref2V/Edit, CosyVoice, Qwen TTS, Fun‑ASR, Qwen ASR, Qwen OCR, Qwen Translation). Fields: id, name, endpoint, auth, status, health, latency, credits, requests, failures, retry, rate‑limits. Persisted metrics via `generation_history` + a new `provider_metrics` view.
2. **Env plumbing.** Read `QWEN_API_KEY` / `DASHSCOPE_API_KEY` (prefer DashScope, fallback Qwen) plus `QWEN_BASE_URL`, `WAN_BASE_URL`, `COSYVOICE_BASE_URL`, `ASR_BASE_URL`, `OCR_BASE_URL`, `TRANSLATION_BASE_URL` inside handlers only.
3. **Server functions / API routes** (all server‑side, RLS enforced, ownership‑checked):
   - `src/lib/dashscope.server.ts` — signed POST helper, retry w/ backoff, error normalization.
   - `src/lib/qwenImage.functions.ts` — Qwen Image 2.0 + Wan T2I (aspect ratios, seed, negative prompt, batch, variations).
   - `src/lib/wanVideo.functions.ts` — Wan T2V / I2V / Ref2V / Edit, async task polling, progress.
   - `src/lib/cosyvoice.functions.ts` — Qwen‑TTS + CosyVoice (voice, emotion, speed, pitch, language).
   - `src/lib/asr.functions.ts` — Fun‑ASR + Qwen‑ASR, SRT/VTT/TXT export, timestamps, speaker diarization when supported.
   - `src/lib/qwenOcr.functions.ts`, `src/lib/qwenTranslate.functions.ts`.
4. **Orchestrator upgrade.** Replace the current "coming soon" stubs in `src/lib/orchestrator.ts` with real routing; keep the `UNAVAILABLE_MESSAGE` fallback for any capability whose env is missing.
5. **Pipeline engine.** New `src/lib/pipeline/engine.ts` — resumable stages (Story → Characters → Storyboard → Prompts → Images → Video → Voice → Subtitles → Package → Export). Persists per‑stage status, duration, provider, credits, errors to `generation_queue` + `generation_history`.
6. **One‑click "Generate Entire Movie"** button on the project detail page, with a stage‑by‑stage progress UI.
7. **Queue / Monitoring / Health.** Extend existing `/jobs`, `/monitoring`, `/system-health` pages to render real per‑provider metrics + health checks (cheap `HEAD`/ping call per provider).
8. **Existing UI panels** (`scene-images-panel`, `audio-panel`, `music-panel`, video studio) switch from the "unavailable" message to the real generator when the provider is configured; unchanged otherwise.

Nothing existing is removed. Auth, Google login, project persistence, export/import, history, feature flags, rich editor, all Phase 1‑3 UI stay intact.

## What I need you to confirm before I ship

1. **Hackathon compliance vs Wan/CosyVoice.** In Phase 3 we removed every non‑Qwen provider "for hackathon compliance" and labeled Wan/CosyVoice "Unavailable". This phase turns them back on as Alibaba Cloud services. **Confirm: Wan, CosyVoice, Fun‑ASR, Qwen‑OCR, Qwen‑Translation are all allowed as Alibaba Cloud offerings for the submission.** (They are Alibaba Cloud, so I'll assume yes unless you say otherwise.)
2. **Endpoints.** I'll target the international DashScope host `https://dashscope-intl.aliyuncs.com` (same host Phase 1's Qwen text uses) for every service unless you set the per‑capability `*_BASE_URL` env var, in which case that wins. OK?
3. **Credentials.** `QWEN_API_KEY` is already saved. Do you also want me to accept `DASHSCOPE_API_KEY` as a fallback name (recommended), and prompt via `add_secret` only if neither is set at generation time? No new secret prompt unless you say so.
4. **Storage.** Generated images/audio/video need a home. I'll create a private Lovable Cloud storage bucket `generated-media` with per‑user RLS and stream provider results into it, returning signed URLs. OK?
5. **Scope of this turn.** Given size, I'd like to ship in this order across up to 3 turns, each independently valid: **(a)** registry + env + storage + Qwen Image 2.0 / Wan T2I + orchestrator wiring + scene panel, **(b)** CosyVoice/Qwen‑TTS + Fun‑ASR/Qwen‑ASR (subtitles) + audio panel, **(c)** Wan video family + pipeline engine + one‑click movie + monitoring/health expansion. Confirm you want all three, or tell me which slice to prioritize.

Reply "go" (or with any changes to 1‑5) and I'll start with slice (a) immediately.
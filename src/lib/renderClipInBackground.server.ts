// Render Engine V4 — Block B: server-only single-clip worker.
//
// Renders ONE queued clip end-to-end using the service role — no browser,
// no user session required. Mirrors the credit + storage + history flow of
// `generateWanVideo` so behaviour, billing and audit trails stay identical
// whether a clip is produced in-browser (legacy pipeline) or by the
// background worker.
//
// This module is `.server.ts` — client bundles cannot reach it.

import type { SceneClip, MovieManifest } from "@/lib/pipelineEngine.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { beginCharge } from "@/lib/creditsInHandler.server";
import { recordGenerationHistory } from "@/lib/generationHistory.server";

const MODEL_FALLBACKS: Record<string, string[]> = {
  t2v: ["wan2.7-t2v", "wan2.7-t2v-2026-06-12", "wan2.7-t2v-2026-04-25"],
  i2v: ["wan2.7-i2v", "wan2.7-i2v-2026-04-25"],
};
const ENDPOINT_T2V = "/api/v1/services/aigc/video-generation/video-synthesis";

export type RenderClipInput = {
  userId: string;
  projectId: string;
  jobId: string;
  clipJobId: string;
  sceneNumber: number;
  clipNumber: number;
  prompt: string;
  duration: number;
  size?: string;
  imageUrl?: string;
  /**
   * Deterministic billing reference. Every retry of the same clip MUST reuse
   * the same value so we can detect a prior successful charge and skip it.
   */
  billingRef?: string;
};

export type RenderClipOutcome = {
  ok: boolean;
  provider?: string;
  model?: string;
  url?: string;
  cover?: string;
  bytes?: number;
  credits?: number;
  latencyMs: number;
  error?: string;
};

export async function renderClipInBackground(input: RenderClipInput): Promise<RenderClipOutcome> {
  const t0 = Date.now();
  const size = input.size ?? "1280*720";
  const ratio = size.includes("720*1280") ? "9:16" : size.includes("1024*1024") ? "1:1" : "16:9";
  const resolution = size.includes("1920") || size.includes("1080") ? "1080P" : "720P";
  const mode = input.imageUrl ? "i2v" : "t2v";
  const preferred = MODEL_FALLBACKS[mode] ?? MODEL_FALLBACKS.t2v;

  // Deterministic per-clip billing reference — reused across every retry so
  // the same clip can never be billed twice. See Block B.5 §1.
  const billingRef = input.billingRef ?? `bgclip_${input.clipJobId}`;

  // Idempotency guard: if a prior worker already committed a charge for
  // this ref, skip reserve/commit entirely and continue rendering. Duplicate
  // completions therefore never create a second charge row.
  const { data: alreadyCharged } = await supabaseAdmin.rpc("has_charged_ref", { _ref: billingRef });
  const skipCharge = alreadyCharged === true;

  const charge = skipCharge
    ? {
        credits: 0,
        operation: "video" as const,
        ref: billingRef,
        async commit() { /* already charged */ },
        async refund() { /* already charged — refunds handled out-of-band */ },
      }
    : await beginCharge({
        userId: input.userId,
        operation: "video",
        units: Math.max(1, Math.round(input.duration)),
        projectId: input.projectId,
        ref: billingRef,
      });

  const { runAsyncTaskWithFallback, getBase, DEFAULT_DASHSCOPE_BASE } = await import("./dashscope.server");
  const base = getBase("WAN_BASE_URL", DEFAULT_DASHSCOPE_BASE);

  let providerError: string | null = null;
  let videoUrl = "";
  let coverUrl = "";
  let model = preferred[0];
  const inputBody: Record<string, unknown> = { prompt: input.prompt };
  if (mode === "i2v" && input.imageUrl) inputBody.media = [{ type: "first_frame", url: input.imageUrl }];

  try {
    const res = await runAsyncTaskWithFallback({
      submitUrl: `${base}${ENDPOINT_T2V}`,
      base,
      timeoutMs: 12 * 60_000,
      pollIntervalMs: 4000,
      models: preferred,
      buildBody: (m) => ({
        model: m,
        input: inputBody,
        parameters: {
          resolution,
          ...(mode === "i2v" ? {} : { ratio }),
          prompt_extend: true,
          watermark: false,
          duration: input.duration,
        },
      }),
    });
    model = res.model;
    videoUrl = (res.output.video_url as string | undefined) ?? "";
    coverUrl = (res.output.cover_image_url as string | undefined) ?? "";
    if (!videoUrl) throw new Error("DashScope returned no video URL.");
  } catch (e) {
    providerError = e instanceof Error ? e.message : String(e);
  }

  // Persist provider output to our own storage bucket so the URL survives
  // beyond DashScope's short-lived signed URLs.
  let storedUrl = videoUrl;
  let bytes = 0;
  if (videoUrl) {
    try {
      const vRes = await fetch(videoUrl);
      if (vRes.ok) {
        const buf = new Uint8Array(await vRes.arrayBuffer());
        bytes = buf.byteLength;
        const name = `${input.userId}/video/${Date.now()}-bg-${input.sceneNumber}-${input.clipNumber}.mp4`;
        const { data: up } = await supabaseAdmin.storage
          .from("generated-media")
          .upload(name, buf, { contentType: "video/mp4", upsert: false });
        if (up) {
          const { data: signed } = await supabaseAdmin.storage
            .from("generated-media")
            .createSignedUrl(up.path, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) storedUrl = signed.signedUrl;
        }
      }
    } catch {
      /* fall back to provider url */
    }
  }

  const latencyMs = Date.now() - t0;

  await recordGenerationHistory({
    user_id: input.userId,
    project_id: input.projectId,
    asset_type: "video",
    provider: model,
    status: providerError ? "failed" : "completed",
    duration_ms: latencyMs,
    credits_used: providerError ? 0 : charge.credits,
    error_message: providerError,
    metadata: {
      background_worker: true,
      job_id: input.jobId,
      clip_job_id: input.clipJobId,
      scene: input.sceneNumber,
      clip: input.clipNumber,
      mode,
      size,
      resolution,
      ratio,
      bytes,
      cover: coverUrl,
      billing_ref: billingRef,
      billing_skipped: skipCharge,
    },
  });

  if (providerError) {
    await charge.refund(providerError);
    return { ok: false, latencyMs, error: providerError, provider: "wan", model };
  }
  await charge.commit(model);

  // Merge this clip's result into projects.video_file.clips so the legacy
  // manifest stays authoritative for Movie Composer and downloads.
  try {
    const { data: proj } = await supabaseAdmin
      .from("projects")
      .select("video_file")
      .eq("id", input.projectId)
      .maybeSingle();
    const manifest = (proj?.video_file as MovieManifest | null) ?? null;
    if (manifest && Array.isArray(manifest.clips)) {
      const idx = manifest.clips.findIndex(
        (c: SceneClip) => c.sceneNumber === input.sceneNumber && c.clipNumber === input.clipNumber,
      );
      if (idx >= 0) {
        manifest.clips[idx] = {
          ...manifest.clips[idx],
          status: "completed",
          url: storedUrl,
          cover: coverUrl,
          provider: model,
          progress: 100,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          error: null,
        };
        if (!manifest.url) manifest.url = storedUrl;
        await supabaseAdmin
          .from("projects")
          .update({
            video_file: manifest,
            render_heartbeat: new Date().toISOString(),
            video_provider: model,
          })
          .eq("id", input.projectId);
      }
    }
  } catch {
    /* manifest update is best-effort */
  }

  return {
    ok: true,
    provider: "wan",
    model,
    url: storedUrl,
    cover: coverUrl,
    bytes,
    credits: charge.credits,
    latencyMs,
  };
}
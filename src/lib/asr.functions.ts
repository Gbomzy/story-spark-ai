import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  audioUrl: z.string().url(),
  model: z.enum(["fun-asr", "fun-asr-2025-11-07", "fun-asr-mtl", "fun-asr-mtl-2025-08-25"]).optional(),
  language: z.string().optional(),
  projectId: z.string().optional(),
});

type Sentence = { text: string; begin_time?: number; end_time?: number };

function fmt(t: number, sep: "," | "."): string {
  const ms = Math.floor(t % 1000);
  const total = Math.floor(t / 1000);
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}${sep}${String(ms).padStart(3, "0")}`;
}

function buildSrt(sentences: Sentence[]): string {
  return sentences
    .map((s, i) => {
      const start = fmt(s.begin_time ?? i * 3000, ",");
      const end = fmt(s.end_time ?? (i + 1) * 3000, ",");
      return `${i + 1}\n${start} --> ${end}\n${s.text}\n`;
    })
    .join("\n");
}

function buildVtt(sentences: Sentence[]): string {
  return `WEBVTT\n\n${sentences
    .map((s, i) => {
      const start = fmt(s.begin_time ?? i * 3000, ".");
      const end = fmt(s.end_time ?? (i + 1) * 3000, ".");
      return `${start} --> ${end}\n${s.text}\n`;
    })
    .join("\n")}`;
}

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    const { runAsyncTask, getBase, DEFAULT_DASHSCOPE_BASE } = await import("./dashscope.server");
    const model = data.model ?? "fun-asr";
    const base = getBase("ASR_BASE_URL", DEFAULT_DASHSCOPE_BASE);

    let providerError: string | null = null;
    let text = "";
    let srt = "";
    let vtt = "";
    let sentences: Sentence[] = [];

    try {
      const output = await runAsyncTask({
        submitUrl: `${base}/api/v1/services/audio/asr/transcription`,
        base,
        body: {
          model,
          input: { file_urls: [data.audioUrl] },
          parameters: {
            ...(data.language ? { language_hints: [data.language] } : {}),
          },
        },
      });
      const results = (output.results as Array<{ transcription_url?: string; subtask_status?: string }>) ?? [];
      const tUrl = results[0]?.transcription_url;
      if (!tUrl) throw new Error("ASR returned no transcription URL.");
      const jsonRes = await fetch(tUrl);
      if (!jsonRes.ok) throw new Error(`Failed to fetch transcript (${jsonRes.status}).`);
      const transcript = (await jsonRes.json()) as {
        transcripts?: Array<{ text?: string; sentences?: Sentence[] }>;
      };
      text = transcript.transcripts?.[0]?.text ?? "";
      sentences = transcript.transcripts?.[0]?.sentences ?? [];
      if (sentences.length) {
        srt = buildSrt(sentences);
        vtt = buildVtt(sentences);
      }
    } catch (e) {
      providerError = e instanceof Error ? e.message : String(e);
    }

    const durationMs = Date.now() - t0;

    {
      const { recordGenerationHistory } = await import("./generationHistory.server");
      await recordGenerationHistory({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        asset_type: "subtitle",
        provider: model,
        status: providerError ? "failed" : "completed",
        duration_ms: durationMs,
        credits_used: providerError ? 0 : 1,
        error_message: providerError,
        metadata: { sentences: sentences.length },
      });
    }

    if (providerError) throw new Error(providerError);
    return { text, srt, vtt, sentences, provider: model, durationMs };
  });
// Subtitle service. Generates SRT and VTT locally from a narration script by
// splitting sentences and estimating timing at ~150 words per minute. No
// external provider needed — the orchestrator marks this capability as
// "connected" so the UI can use it immediately.
export type SubtitleAsset = {
  url: string | null;
  format: "srt" | "vtt";
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

const WORDS_PER_MINUTE = 150;

function splitSentences(script: string): string[] {
  return script
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmt(t: number, sep: "," | "."): string {
  const ms = Math.floor((t % 1) * 1000);
  const total = Math.floor(t);
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}${sep}${String(ms).padStart(3, "0")}`;
}

export function buildSubtitles(script: string): { srt: string; vtt: string; cues: number; durationSeconds: number } {
  const sentences = splitSentences(script);
  let t = 0;
  const rows = sentences.map((text, i) => {
    const words = Math.max(1, text.split(/\s+/).length);
    const dur = Math.max(1.2, (words / WORDS_PER_MINUTE) * 60);
    const start = t;
    const end = t + dur;
    t = end + 0.15;
    return { i: i + 1, start, end, text };
  });
  const srt = rows.map((r) => `${r.i}\n${fmt(r.start, ",")} --> ${fmt(r.end, ",")}\n${r.text}\n`).join("\n");
  const vtt = `WEBVTT\n\n${rows.map((r) => `${fmt(r.start, ".")} --> ${fmt(r.end, ".")}\n${r.text}\n`).join("\n")}`;
  return { srt, vtt, cues: rows.length, durationSeconds: Math.ceil(t) };
}

export const subtitleService = {
  isConfigured(): boolean {
    return true;
  },
  async generateFromScript(script: string, format: "srt" | "vtt" = "srt"): Promise<SubtitleAsset & { text: string; cues: number; durationSeconds: number }> {
    const built = buildSubtitles(script);
    const text = format === "vtt" ? built.vtt : built.srt;
    const url = `data:text/${format === "vtt" ? "vtt" : "plain"};charset=utf-8,${encodeURIComponent(text)}`;
    return { url, format, status: "ready", text, cues: built.cues, durationSeconds: built.durationSeconds };
  },
  /** Fun-ASR / Qwen-ASR transcription of a hosted audio URL. */
  async transcribeAudio(audioUrl: string, opts?: { format?: "srt" | "vtt" | "txt"; language?: string; projectId?: string; model?: "paraformer-v2" | "paraformer-v1" | "qwen-audio-asr" }) {
    const { transcribeAudio } = await import("./asr.functions");
    const r = await transcribeAudio({ data: { audioUrl, language: opts?.language, projectId: opts?.projectId, model: opts?.model } });
    const fmt = opts?.format ?? "srt";
    const text = fmt === "vtt" ? r.vtt : fmt === "txt" ? r.text : r.srt;
    const url = `data:text/${fmt === "vtt" ? "vtt" : "plain"};charset=utf-8,${encodeURIComponent(text)}`;
    return { url, format: fmt, status: "ready" as const, text, provider: r.provider, sentences: r.sentences };
  },
  parseAsset(value: string | null | undefined): SubtitleAsset {
    if (!value) return { url: null, format: "srt", status: "idle" };
    try {
      const parsed = JSON.parse(value) as Partial<SubtitleAsset>;
      return {
        url: parsed.url ?? null,
        format: parsed.format ?? "srt",
        status: parsed.url ? "ready" : "idle",
      };
    } catch {
      return { url: value, format: "srt", status: "ready" };
    }
  },
};
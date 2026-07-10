// Credit + processing-time estimation for every generation type.
// Pure client-side heuristics — no external API calls.
export type EstimatorKind =
  | "story"
  | "characters"
  | "storyboard"
  | "voice"
  | "songs"
  | "image_prompts"
  | "seo"
  | "video";

export interface EstimateInput {
  kind: EstimatorKind;
  words?: number;      // approx word count of source prompt/context
  scenes?: number;     // for storyboard/video
  seconds?: number;    // for voice/music/video
  resolution?: "480p" | "720p" | "1080p" | "2k" | "4k";
  creativity?: number; // 0-1
}

export interface EstimateResult {
  credits: number;
  seconds: number;
  label: string;
}

const RES_MULT: Record<string, number> = { "480p": 1, "720p": 1.5, "1080p": 2, "2k": 3.5, "4k": 6 };

export function estimate(input: EstimateInput): EstimateResult {
  const w = input.words ?? 400;
  const s = input.scenes ?? 6;
  const sec = input.seconds ?? 30;
  const cm = 1 + (input.creativity ?? 0.5) * 0.4;
  const rm = RES_MULT[input.resolution ?? "1080p"] ?? 2;
  switch (input.kind) {
    case "story":         return { credits: Math.ceil(w * 0.02 * cm), seconds: Math.max(6, Math.ceil(w * 0.02)),  label: "Story" };
    case "characters":    return { credits: Math.ceil(6 * cm),         seconds: 8,                                  label: "Characters" };
    case "storyboard":    return { credits: Math.ceil(s * 3 * cm),     seconds: Math.max(10, s * 2),                label: "Storyboard" };
    case "voice":         return { credits: Math.ceil(sec * 0.5),      seconds: Math.max(8, Math.ceil(sec * 0.3)),  label: "Voice" };
    case "songs":         return { credits: Math.ceil(sec * 0.8),      seconds: Math.max(15, Math.ceil(sec * 0.5)), label: "Songs" };
    case "image_prompts": return { credits: Math.ceil(s * 1.5 * cm),   seconds: Math.max(6, s * 1),                 label: "Image Prompts" };
    case "seo":           return { credits: 4,                          seconds: 6,                                  label: "SEO" };
    case "video":         return { credits: Math.ceil(sec * 8 * rm),   seconds: Math.max(30, Math.ceil(sec * 6 * rm)), label: "Video" };
  }
}

export function estimateAll(project: { scenes?: number; targetSeconds?: number; resolution?: EstimateInput["resolution"] }): EstimateResult[] {
  const base: Partial<EstimateInput> = { scenes: project.scenes, seconds: project.targetSeconds, resolution: project.resolution };
  return (["story","characters","storyboard","voice","songs","image_prompts","seo","video"] as EstimatorKind[])
    .map((k) => estimate({ kind: k, ...base } as EstimateInput));
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}
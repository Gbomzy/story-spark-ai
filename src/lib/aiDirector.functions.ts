import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// AI Director — analyzes a storyboard and returns cinematic direction per scene.
// Persisted on projects.story_bible.direction[sceneId] and consumed by
// downstream image / video prompt composition.

export type SceneDirection = {
  cameraAngle: string;
  cameraDistance: string;
  cameraMovement: string;
  lighting: string;
  weather: string;
  timeOfDay: string;
  emotion: string;
  musicMood: string;
  transition: string;
  colorPalette: string;
};

export type DirectionMap = Record<string, SceneDirection>;

const QWEN_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_MODEL = "qwen-plus";

function fallbackDirection(prompt: string): SceneDirection {
  const lower = prompt.toLowerCase();
  const night = /(night|dark|moon|bedtime|starry)/.test(lower);
  const happy = /(happy|joy|celebrat|party|smile|laugh)/.test(lower);
  const scary = /(fear|scary|shadow|dark|monster|mystery)/.test(lower);
  return {
    cameraAngle: "eye-level",
    cameraDistance: "medium shot",
    cameraMovement: "slow push-in",
    lighting: night ? "moonlit" : "soft natural light",
    weather: "clear",
    timeOfDay: night ? "night" : "day",
    emotion: happy ? "joyful" : scary ? "tense" : "curious",
    musicMood: happy ? "happy" : scary ? "mystery" : "calm",
    transition: "fade",
    colorPalette: night ? "cool blues and violets" : "warm pastels",
  };
}

const AnalyzeInput = z.object({
  scenes: z.array(z.object({
    id: z.string().min(1),
    prompt: z.string().min(1),
  })).min(1).max(40),
  projectContext: z.string().max(2000).optional(),
});

async function callQwenJson(system: string, user: string): Promise<unknown> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("QWEN_API_KEY not configured");
  const res = await fetch(QWEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Qwen ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return {}; }
}

export const analyzeStoryboardDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<{ direction: DirectionMap }> => {
    // Try the model first; on any error, fall back to heuristic per scene.
    const system =
      "You are an experienced film director. For each scene given, produce a compact JSON " +
      "object mapping sceneId to a direction object with keys: cameraAngle, cameraDistance, " +
      "cameraMovement, lighting, weather, timeOfDay, emotion, musicMood, transition, colorPalette. " +
      "Values are short lowercase strings (2-5 words). Respond ONLY with JSON: { direction: { [sceneId]: {...} } }.";
    const user = JSON.stringify({
      context: data.projectContext ?? "",
      scenes: data.scenes,
    });

    try {
      const parsed = await callQwenJson(system, user) as { direction?: Record<string, Partial<SceneDirection>> };
      const out: DirectionMap = {};
      for (const scene of data.scenes) {
        const raw = parsed?.direction?.[scene.id];
        const fb = fallbackDirection(scene.prompt);
        out[scene.id] = {
          cameraAngle: String(raw?.cameraAngle ?? fb.cameraAngle),
          cameraDistance: String(raw?.cameraDistance ?? fb.cameraDistance),
          cameraMovement: String(raw?.cameraMovement ?? fb.cameraMovement),
          lighting: String(raw?.lighting ?? fb.lighting),
          weather: String(raw?.weather ?? fb.weather),
          timeOfDay: String(raw?.timeOfDay ?? fb.timeOfDay),
          emotion: String(raw?.emotion ?? fb.emotion),
          musicMood: String(raw?.musicMood ?? fb.musicMood),
          transition: String(raw?.transition ?? fb.transition),
          colorPalette: String(raw?.colorPalette ?? fb.colorPalette),
        };
      }
      return { direction: out };
    } catch {
      const out: DirectionMap = {};
      for (const scene of data.scenes) out[scene.id] = fallbackDirection(scene.prompt);
      return { direction: out };
    }
  });

/** Merge scene direction into a base scene prompt for downstream generators. */
export function applyDirectionToPrompt(basePrompt: string, direction: SceneDirection | undefined): string {
  if (!direction) return basePrompt;
  const bits = [
    `${direction.cameraDistance} ${direction.cameraAngle}`,
    `${direction.cameraMovement}`,
    `${direction.lighting}, ${direction.timeOfDay}, ${direction.weather}`,
    `mood: ${direction.emotion}`,
    `palette: ${direction.colorPalette}`,
  ];
  return `${basePrompt}\n\nDirection: ${bits.join(" · ")}.`;
}
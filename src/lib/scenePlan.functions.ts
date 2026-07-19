import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseScenePlan,
  scenePlanToStoryboard,
  scenePlanToVoiceScript,
  scenePlanToImagesJson,
  validateScenePlan,
  type ScenePlan,
} from "@/lib/scenePlan";

const QWEN_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_MODEL = "qwen-plus";

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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Qwen ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

const PLAN_SYSTEM = `You are StorySpark AI's Scene Plan Director. From a finished children's story, produce ONE authoritative structured Scene Plan.

This plan is the SINGLE SOURCE OF TRUTH. Narration, storyboard, image prompts, video prompts, subtitles and the final render will all be derived from it. Every scene action you write must be VISIBLE (a camera can film it). Every narration line must describe exactly what is visible in that scene — the narrator and the visuals must match perfectly.

Character consistency: describe each character ONCE with full appearance (hair, eyes, skin, build, distinctive features, age) and clothing (full outfit). This exact description is reused in every scene the character appears in. Never change a character's appearance or outfit unless the story explicitly requires it.

Environment consistency: describe each location ONCE with full detail (layout, key props, colors, lighting). This is reused for every scene set there.

Camera: for each scene pick one shot type (wide, medium, close-up, extreme close-up, over-the-shoulder, two-shot, tracking) and one movement (static, slow push-in, pull-out, pan left, pan right, dolly, tracking, tilt up).

Output ONLY valid JSON matching this exact TypeScript type:
{
  "title": string,
  "logline": string,
  "artStyle": string,
  "characters": Array<{ "id": string, "name": string, "role": string, "age": string, "appearance": string, "clothing": string, "personality": string, "voice": string }>,
  "environments": Array<{ "id": string, "name": string, "description": string, "lighting": string, "weather": string, "timeOfDay": string, "ambientSound": string }>,
  "scenes": Array<{
    "sceneNumber": number,
    "title": string,
    "action": string,
    "characterIds": string[],
    "characterEmotions": Record<string,string>,
    "characterPositions": Record<string,string>,
    "environmentId": string,
    "timeOfDay": string,
    "weather": string,
    "props": string[],
    "cameraShot": string,
    "cameraMovement": string,
    "narration": string,
    "dialogue": Array<{ "characterId": string, "line": string, "delivery": string }>,
    "durationSeconds": number,
    "transitionOut": "cut" | "fade" | "crossfade" | "dissolve" | "slide" | "match cut"
  }>
}

Character ids look like "char-1", "char-2". Environment ids look like "env-1", "env-2". Aim for 6–12 scenes. Each scene 4–10 seconds. No preamble, no commentary — JSON only.`;

const GenerateInput = z.object({
  projectId: z.string().optional(),
  prompt: z.string().min(1),
  story: z.string().min(1),
  ageGroup: z.string().optional(),
  artStyle: z.string().optional(),
  language: z.string().optional(),
  category: z.string().optional(),
});

export const generateScenePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { beginCharge } = await import("./creditsInHandler.server");
    const charge = await beginCharge({
      userId: context.userId,
      operation: "story",
      units: 2,
      projectId: data.projectId ?? null,
    });
    try {
      const user = JSON.stringify({
        brief: data.prompt,
        story: data.story,
        ageGroup: data.ageGroup ?? "children",
        artStyle: data.artStyle ?? "warm cinematic 3D animation, Pixar-inspired",
        language: data.language ?? "en",
        category: data.category ?? null,
      });
      const categorySuffix = data.category
        ? `\n\nCategory: ${data.category}. Every character, environment, prop, wardrobe, camera choice, narration line and dialogue MUST clearly belong to this category. Reject any framing that conflicts with it.`
        : "";
      const raw = await callQwenJson(PLAN_SYSTEM + categorySuffix, user);
      const plan = parseScenePlan(raw);
      if (!plan) throw new Error("Scene Plan generation returned invalid structure.");
      const validation = validateScenePlan(plan);

      // Derive downstream artefacts from the plan — these become the
      // authoritative storyboard / narration / image prompts for the
      // entire pipeline.
      const storyboard = scenePlanToStoryboard(plan);
      const voiceScript = scenePlanToVoiceScript(plan);
      const images = scenePlanToImagesJson(plan);

      // Persist onto the project if we have one.
      if (data.projectId) {
        const { data: existing } = await context.supabase
          .from("projects")
          .select("story_bible")
          .eq("id", data.projectId)
          .single();
        const existingBible = (existing?.story_bible as Record<string, unknown> | null) ?? {};
        const nextBible = {
          ...existingBible,
          version: 1,
          scenePlan: plan,
          validation,
          updatedAt: new Date().toISOString(),
        };
        await context.supabase
          .from("projects")
          .update({
            story_bible: nextBible,
            storyboard,
            voice: voiceScript,
            images: JSON.stringify(images),
          })
          .eq("id", data.projectId);
      }

      await charge.commit("qwen-plus");
      return {
        plan,
        storyboard,
        voiceScript,
        images,
        validation,
        creditsUsed: charge.credits,
      };
    } catch (e) {
      await charge.refund((e as Error)?.message);
      throw e;
    }
  });

// Server-side helper for pipeline stages — read the persisted plan.
export function readScenePlanFromBible(bible: unknown): ScenePlan | null {
  if (!bible || typeof bible !== "object") return null;
  const b = bible as Record<string, unknown>;
  return parseScenePlan(b.scenePlan);
}

const ValidateInput = z.object({ projectId: z.string() });

export const validateProjectScenePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ValidateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: proj, error } = await context.supabase
      .from("projects")
      .select("story_bible")
      .eq("id", data.projectId)
      .single();
    if (error || !proj) throw new Error(error?.message ?? "Project not found");
    const plan = readScenePlanFromBible(proj.story_bible);
    if (!plan) return { ok: false, issues: [{ sceneNumber: 0, kind: "missing_narration" as const, message: "No Scene Plan for this project." }] };
    return validateScenePlan(plan);
  });
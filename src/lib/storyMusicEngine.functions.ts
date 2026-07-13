import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { StoryMusicPlan, MusicMode, SongPosition, BgmMood, SfxKind } from "@/lib/storyMusic";

const QWEN_ENDPOINT = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_MODEL = "qwen-plus";

type QwenMessage = { role: "system" | "user" | "assistant"; content: string };

async function callQwen(messages: QwenMessage[]): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("QWEN_API_KEY is not configured.");
  const res = await fetch(QWEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qwen API error (${res.status}): ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function stripCodeFence(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }
  return t;
}

const BGM_MOODS = [
  "happy",
  "calm",
  "bedtime",
  "adventure",
  "celebration",
  "mystery",
  "emotional",
  "funny",
] as const;

const SFX_KINDS = [
  "birds",
  "forest",
  "rain",
  "ocean",
  "wind",
  "footsteps",
  "door",
  "school",
  "crowd",
  "magic",
  "celebration",
] as const;

const AnalyzeInput = z.object({
  prompt: z.string().min(1),
  story: z.string().min(20),
  ageGroup: z.string().optional(),
  language: z.string().optional(),
  mode: z.enum(["story_only", "story_ending", "musical", "custom"]),
  customPosition: z.enum(["none", "intro", "middle", "ending", "multiple"]).optional(),
  customMoodOverride: z.enum(BGM_MOODS).optional(),
});

function modeInstruction(mode: MusicMode, customPosition?: SongPosition): string {
  switch (mode) {
    case "story_only":
      return 'MODE=STORY_ONLY. Do NOT produce a song. Set songNeeded=false, songPosition="none", song=null.';
    case "story_ending":
      return 'MODE=STORY_ENDING. Produce exactly ONE song at the END of the story. Set songNeeded=true, songPosition="ending".';
    case "musical":
      return 'MODE=MUSICAL. Produce a song appropriate for a musical (intro OR multiple placements). Set songNeeded=true, songPosition="multiple".';
    case "custom":
      if (!customPosition || customPosition === "none") {
        return 'MODE=CUSTOM (no song). Set songNeeded=false, songPosition="none", song=null.';
      }
      return `MODE=CUSTOM. Produce ONE song. Set songNeeded=true, songPosition="${customPosition}".`;
  }
}

export const analyzeStoryMusic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ plan: StoryMusicPlan; creditsUsed: number }> => {
    const { beginCharge } = await import("./creditsInHandler.server");
    const charge = await beginCharge({ userId: context.userId, operation: "story", units: 2 });

    const forceInstruction = modeInstruction(data.mode, data.customPosition);
    const moodOverride = data.customMoodOverride
      ? `Prefer bgmMood="${data.customMoodOverride}" for scenes unless a different mood is clearly required by that scene.`
      : "";

    const system = `You are StorySpark AI's Story Music Engine. You analyze a children's educational story and produce a music plan.

${forceInstruction}
${moodOverride}

You MUST return ONLY a strict JSON object matching this TypeScript type — no prose, no code fences:

{
  "version": 1,
  "mode": "story_only" | "story_ending" | "musical" | "custom",
  "analysis": {
    "theme": string,          // one short phrase
    "mood": string,           // one short phrase
    "lesson": string,         // one sentence
    "targetAge": string,      // e.g. "3-5", "6-8", "9-12"
    "emotionalArc": string    // one sentence describing the arc
  },
  "recommendation": {
    "songNeeded": boolean,
    "songPosition": "none" | "intro" | "middle" | "ending" | "multiple",
    "reasoning": string,      // 1-2 sentences
    "backgroundStyle": string // e.g. "warm acoustic guitar, gentle strings"
  },
  "scenes": [
    {
      "sceneNumber": number,  // starting at 1
      "title": string,        // short scene title
      "bgmMood": "happy" | "calm" | "bedtime" | "adventure" | "celebration" | "mystery" | "emotional" | "funny",
      "volume": number,       // 0..1 recommended duck level under narration; default 0.2
      "narrationVolume": number, // 0..1 default 1
      "sfx": [                // 0..3 recommended sound effects for the scene
        { "kind": "birds"|"forest"|"rain"|"ocean"|"wind"|"footsteps"|"door"|"school"|"crowd"|"magic"|"celebration", "volume": number }
      ]
    }
  ],
  "endingCredits": {
    "enabled": boolean,        // true when a song or credits closer suits this story
    "fadeOutSeconds": number,  // 2-6
    "text": string             // optional short closing line
  },
  "song": null | {
    "position": "intro" | "middle" | "ending" | "multiple",
    "title": string,
    "verses": string[],       // 1-3 short verses
    "chorus": string,
    "bridge": string | null,
    "estimatedDurationSeconds": number,   // e.g. 60-120
    "singability": "easy" | "medium" | "hard",
    "reinforcesLesson": string            // how the song reinforces (not repeats) the lesson
  }
}

Requirements:
- The song MUST reinforce the story's lesson, not retell the plot.
- Cover EVERY scene in the story (infer 4-8 scenes if not explicit).
- Recommend 0-3 sound effects per scene that ACTUALLY appear in that scene (birds only if outdoors, rain only if raining, etc.). Never invent effects.
- Keep language age-appropriate.${data.ageGroup ? ` Target age: ${data.ageGroup}.` : ""}${data.language ? ` Write lyrics in ${data.language}.` : ""}
- Return ONLY JSON. No commentary.`;

    const userPrompt = `Project brief:\n${data.prompt}\n\nStory:\n${data.story}`;

    try {
      const raw = await callQwen([
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ]);
      const jsonText = stripCodeFence(raw);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        // last-ditch: extract first {...} block
        const m = jsonText.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("Model did not return JSON.");
        parsed = JSON.parse(m[0]);
      }
      const plan = normalizePlan(parsed, data.mode);
      await charge.commit("qwen-plus");
      return { plan, creditsUsed: charge.credits };
    } catch (e) {
      await charge.refund((e as Error)?.message);
      throw e;
    }
  });

function normalizePlan(input: unknown, mode: MusicMode): StoryMusicPlan {
  const o = (input ?? {}) as Record<string, unknown>;
  const analysis = (o.analysis ?? {}) as Record<string, unknown>;
  const rec = (o.recommendation ?? {}) as Record<string, unknown>;
  const scenesRaw = Array.isArray(o.scenes) ? (o.scenes as unknown[]) : [];
  const songRaw = (o.song ?? null) as Record<string, unknown> | null;

  const posSet = new Set(["none", "intro", "middle", "ending", "multiple"]);
  const songPosition: SongPosition = posSet.has(String(rec.songPosition))
    ? (String(rec.songPosition) as SongPosition)
    : "none";

  const scenes = scenesRaw.map((s, i) => {
    const so = (s ?? {}) as Record<string, unknown>;
    const mood = String(so.bgmMood ?? "calm");
    const bgmMood: BgmMood = (BGM_MOODS as readonly string[]).includes(mood)
      ? (mood as BgmMood)
      : "calm";
    const vol = Number(so.volume);
    const narrVol = Number(so.narrationVolume);
    const sfxRaw = Array.isArray(so.sfx) ? (so.sfx as unknown[]) : [];
    const sfx = sfxRaw
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        const kind = String(o.kind ?? "");
        if (!(SFX_KINDS as readonly string[]).includes(kind)) return null;
        const v = Number(o.volume);
        return {
          kind: kind as SfxKind,
          volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6,
        };
      })
      .filter((x): x is { kind: SfxKind; volume: number } => x !== null)
      .slice(0, 3);
    return {
      sceneNumber: Number.isFinite(Number(so.sceneNumber)) ? Number(so.sceneNumber) : i + 1,
      title: String(so.title ?? `Scene ${i + 1}`),
      bgmMood,
      volume: Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.2,
      narrationVolume: Number.isFinite(narrVol) ? Math.min(1, Math.max(0, narrVol)) : 1,
      sfx,
    };
  });

  const song =
    songRaw && typeof songRaw === "object" && songRaw.title
      ? {
          position: (["intro", "middle", "ending", "multiple"].includes(String(songRaw.position))
            ? String(songRaw.position)
            : "ending") as "intro" | "middle" | "ending" | "multiple",
          title: String(songRaw.title ?? "Untitled"),
          verses: Array.isArray(songRaw.verses) ? songRaw.verses.map((v) => String(v)) : [],
          chorus: String(songRaw.chorus ?? ""),
          bridge: songRaw.bridge ? String(songRaw.bridge) : undefined,
          estimatedDurationSeconds: Number.isFinite(Number(songRaw.estimatedDurationSeconds))
            ? Number(songRaw.estimatedDurationSeconds)
            : 60,
          singability: (["easy", "medium", "hard"].includes(String(songRaw.singability))
            ? String(songRaw.singability)
            : "easy") as "easy" | "medium" | "hard",
          reinforcesLesson: String(songRaw.reinforcesLesson ?? ""),
        }
      : null;

  return {
    version: 1,
    mode,
    analysis: {
      theme: String(analysis.theme ?? ""),
      mood: String(analysis.mood ?? ""),
      lesson: String(analysis.lesson ?? ""),
      targetAge: String(analysis.targetAge ?? ""),
      emotionalArc: String(analysis.emotionalArc ?? ""),
    },
    recommendation: {
      songNeeded: Boolean(rec.songNeeded),
      songPosition,
      reasoning: String(rec.reasoning ?? ""),
      backgroundStyle: String(rec.backgroundStyle ?? ""),
    },
    scenes,
    song,
    endingCredits: readEndingCredits(o),
  };
}

function readEndingCredits(o: Record<string, unknown>): StoryMusicPlan["endingCredits"] {
  const ec =
    o.endingCredits && typeof o.endingCredits === "object"
      ? (o.endingCredits as Record<string, unknown>)
      : null;
  if (!ec) return undefined;
  const fade = Number(ec.fadeOutSeconds);
  return {
    enabled: Boolean(ec.enabled),
    fadeOutSeconds: Number.isFinite(fade) ? Math.min(10, Math.max(1, fade)) : 3,
    text: typeof ec.text === "string" ? ec.text : undefined,
  };
}

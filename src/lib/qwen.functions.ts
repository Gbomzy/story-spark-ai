import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const QWEN_ENDPOINT =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_MODEL = "qwen-plus";

type QwenMessage = { role: "system" | "user" | "assistant"; content: string };

async function callQwen(messages: QwenMessage[], model = DEFAULT_MODEL) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new Error("QWEN_API_KEY is not configured. Add it in Settings.");
  }
  const res = await fetch(QWEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qwen API error (${res.status}): ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export const getQwenStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    return { connected: Boolean(process.env.QWEN_API_KEY) };
  },
);

export const testQwenConnection = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const reply = await callQwen(
        [
          { role: "system", content: "Reply with the single word: ok" },
          { role: "user", content: "ping" },
        ],
        DEFAULT_MODEL,
      );
      return { ok: true, reply };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
);

const ChatInput = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  model: z.string().optional(),
});

export const qwenChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const content = await callQwen(data.messages, data.model);
    return { content };
  });

const StoryInput = z.object({
  prompt: z.string().min(1),
  ageGroup: z.string().optional(),
  language: z.string().optional(),
  length: z.string().optional(),
  learningGoal: z.string().optional(),
  category: z.string().optional(),
});

export const generateStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { beginCharge } = await import("./creditsInHandler.server");
    const charge = await beginCharge({ userId: context.userId, operation: "story", units: 1 });
    const system = `You are StorySpark AI, an expert children's educational story writer. Write engaging, age-appropriate stories with a clear narrative arc.${
      data.ageGroup ? ` Target age: ${data.ageGroup}.` : ""
    }${data.language ? ` Language: ${data.language}.` : ""}${
      data.length ? ` Length: ${data.length}.` : ""
    }${data.learningGoal ? ` Learning goal: ${data.learningGoal}.` : ""}${
      data.category ? ` Category: ${data.category}. The story MUST clearly belong to this category — reject any prior template framing that conflicts with it.` : ""
    }`;
    try {
      const content = await callQwen([
        { role: "system", content: system },
        { role: "user", content: data.prompt },
      ]);
      await charge.commit("qwen-plus");
      return { story: content, creditsUsed: charge.credits };
    } catch (e) {
      await charge.refund((e as Error)?.message);
      throw e;
    }
  });

const CharactersInput = z.object({
  prompt: z.string().min(1),
  story: z.string().optional(),
  ageGroup: z.string().optional(),
  language: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
});

export const generateCharacters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CharactersInput.parse(input))
  .handler(async ({ data, context }) => {
    const { beginCharge } = await import("./creditsInHandler.server");
    const charge = await beginCharge({ userId: context.userId, operation: "character", units: data.count ?? 4 });
    const count = data.count ?? 4;
    const system = `You are StorySpark AI's Character Agent. Design ${count} memorable, age-appropriate characters for a children's educational story.${
      data.ageGroup ? ` Target age: ${data.ageGroup}.` : ""
    }${data.language ? ` Write in ${data.language}.` : ""}

For each character output this exact markdown structure, separated by a blank line:

### {Name} — {one-line role}
- Appearance: {short visual description suitable for an illustrator}
- Personality: {2-3 traits}
- Voice: {tone, pace, accent hints}
- Arc: {how they grow or contribute to the learning goal}
- Catchphrase: "{short signature line}"

Keep descriptions vivid but concise. Do not add any preamble or closing text.`;
    const userPrompt = data.story
      ? `Project brief:\n${data.prompt}\n\nStory draft:\n${data.story}`
      : `Project brief:\n${data.prompt}`;
    try {
      const content = await callQwen([
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ]);
      await charge.commit("qwen-plus");
      return { characters: content, creditsUsed: charge.credits };
    } catch (e) {
      await charge.refund((e as Error)?.message);
      throw e;
    }
  });

const StoryboardInput = z.object({
  prompt: z.string().min(1),
  story: z.string().optional(),
  ageGroup: z.string().optional(),
  language: z.string().optional(),
  style: z.string().optional(),
  scenes: z.number().int().min(3).max(20).optional(),
});

export const generateStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StoryboardInput.parse(input))
  .handler(async ({ data, context }) => {
    const { beginCharge } = await import("./creditsInHandler.server");
    const charge = await beginCharge({ userId: context.userId, operation: "storyboard", units: data.scenes ?? 6 });
    const scenes = data.scenes ?? 6;
    const system = `You are StorySpark AI's Storyboard Agent. Break the story into ${scenes} cinematic scenes for a children's educational animation.${
      data.ageGroup ? ` Target age: ${data.ageGroup}.` : ""
    }${data.language ? ` Write in ${data.language}.` : ""}${
      data.style ? ` Animation style: ${data.style}.` : ""
    }

For each scene output this exact markdown structure, separated by a blank line:

## Scene {n} — {short title}
- Setting: {location, time of day, mood}
- Characters: {who appears}
- Action: {what happens in 1-2 sentences}
- Shot: {shot type and camera move, e.g. wide establishing, slow push-in}
- Dialogue/VO: "{key line or narration beat}"
- Sound: {ambient sound, music cue or SFX}

Keep scenes tight and visual. Do not add any preamble or closing text.`;
    const userPrompt = data.story
      ? `Project brief:\n${data.prompt}\n\nStory draft:\n${data.story}`
      : `Project brief:\n${data.prompt}`;
    try {
      const content = await callQwen([
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ]);
      await charge.commit("qwen-plus");
      return { storyboard: content, creditsUsed: charge.credits };
    } catch (e) {
      await charge.refund((e as Error)?.message);
      throw e;
    }
  });

const MediaPackInput = z.object({
  prompt: z.string().min(1),
  story: z.string().min(1),
  ageGroup: z.string().optional(),
  language: z.string().optional(),
  style: z.string().optional(),
});

function extractSection(text: string, tag: string): string {
  const re = new RegExp(`===${tag}===\\s*([\\s\\S]*?)(?=\\n===[A-Z_]+===|$)`);
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

export const generateMediaPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MediaPackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { beginCharge } = await import("./creditsInHandler.server");
    const charge = await beginCharge({ userId: context.userId, operation: "story", units: 4 });
    const system = `You are StorySpark AI's multi-agent media producer. Given a children's educational story, you will output FOUR assets in a SINGLE response using the exact delimiter format below. Do not add any preamble, closing text, or commentary outside the sections.${
      data.ageGroup ? ` Target age: ${data.ageGroup}.` : ""
    }${data.language ? ` Write in ${data.language}.` : ""}${
      data.style ? ` Animation style: ${data.style}.` : ""
    }

Output format (use these exact delimiter lines, in this exact order):

===VOICE===
A complete narration script for the story. Include:
- [NARRATOR] lines for description and transitions
- [CHARACTER NAME] lines for dialogue with brief tone cues in parentheses, e.g. (warmly), (whispering)
- [PAUSE 1s] or [SFX: ...] cues where helpful
Cover the full story from open to close, in order.

===SONGS===
An original children's song inspired by the story. Use this structure with labeled sections:
Title: {song title}

[Verse 1]
...

[Chorus]
...

[Verse 2]
...

[Chorus]
...

[Bridge]
...

[Ending]
...

Include a short "Melody hints:" line at the end (tempo, mood, instrumentation).

===IMAGES===
Detailed cinematic AI image prompts, one per scene, numbered. For each scene output:

## Scene {n} — {short title}
Prompt: {one rich paragraph describing characters (keep appearance consistent across scenes — repeat key visual traits), environment, lighting, camera angle, art style, mood, and color palette. Suitable for an image model.}
Negative prompt: {short comma list of things to avoid}

Keep character descriptions consistent across every scene so the same character looks the same.

===SEO===
Produce discovery metadata as a markdown list with these exact labels:
- SEO Title: {<=60 chars}
- SEO Description: {<=160 chars}
- YouTube Title: {<=70 chars, engaging}
- YouTube Description: {2-3 short paragraphs, include a call to subscribe}
- Keywords: {comma-separated, 10-15 items}
- Tags: {comma-separated, 10-15 items}
- Hashtags: {space-separated #tags, 8-12 items}`;

    const userPrompt = `Project brief:\n${data.prompt}\n\nStory:\n${data.story}`;
    try {
      const content = await callQwen([
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ]);
      await charge.commit("qwen-plus");
      return {
        voice: extractSection(content, "VOICE"),
        songs: extractSection(content, "SONGS"),
        images: extractSection(content, "IMAGES"),
        seo: extractSection(content, "SEO"),
        raw: content,
        creditsUsed: charge.credits,
      };
    } catch (e) {
      await charge.refund((e as Error)?.message);
      throw e;
    }
  });
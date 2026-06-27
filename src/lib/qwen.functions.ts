import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
});

export const generateStory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StoryInput.parse(input))
  .handler(async ({ data }) => {
    const system = `You are StorySpark AI, an expert children's educational story writer. Write engaging, age-appropriate stories with a clear narrative arc.${
      data.ageGroup ? ` Target age: ${data.ageGroup}.` : ""
    }${data.language ? ` Language: ${data.language}.` : ""}${
      data.length ? ` Length: ${data.length}.` : ""
    }${data.learningGoal ? ` Learning goal: ${data.learningGoal}.` : ""}`;
    const content = await callQwen([
      { role: "system", content: system },
      { role: "user", content: data.prompt },
    ]);
    return { story: content };
  });

const CharactersInput = z.object({
  prompt: z.string().min(1),
  story: z.string().optional(),
  ageGroup: z.string().optional(),
  language: z.string().optional(),
  count: z.number().int().min(1).max(8).optional(),
});

export const generateCharacters = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CharactersInput.parse(input))
  .handler(async ({ data }) => {
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
    const content = await callQwen([
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ]);
    return { characters: content };
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
  .inputValidator((input: unknown) => StoryboardInput.parse(input))
  .handler(async ({ data }) => {
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
    const content = await callQwen([
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ]);
    return { storyboard: content };
  });
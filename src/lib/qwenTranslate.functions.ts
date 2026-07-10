import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  text: z.string().min(1),
  targetLanguage: z.string().min(2),
  sourceLanguage: z.string().optional(),
  projectId: z.string().optional(),
});

export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "English", label: "English" },
  { code: "Chinese (Simplified)", label: "Chinese (Simplified)" },
  { code: "Chinese (Traditional)", label: "Chinese (Traditional)" },
  { code: "Spanish", label: "Spanish" },
  { code: "French", label: "French" },
  { code: "German", label: "German" },
  { code: "Italian", label: "Italian" },
  { code: "Portuguese", label: "Portuguese" },
  { code: "Russian", label: "Russian" },
  { code: "Japanese", label: "Japanese" },
  { code: "Korean", label: "Korean" },
  { code: "Arabic", label: "Arabic" },
  { code: "Hindi", label: "Hindi" },
  { code: "Turkish", label: "Turkish" },
  { code: "Vietnamese", label: "Vietnamese" },
  { code: "Thai", label: "Thai" },
  { code: "Indonesian", label: "Indonesian" },
  { code: "Dutch", label: "Dutch" },
  { code: "Polish", label: "Polish" },
  { code: "Swedish", label: "Swedish" },
  { code: "Ukrainian", label: "Ukrainian" },
  { code: "Hebrew", label: "Hebrew" },
];

export const qwenTranslate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
    if (!apiKey) throw new Error("QWEN_API_KEY / DASHSCOPE_API_KEY is not configured.");
    const t0 = Date.now();

    const source = data.sourceLanguage && data.sourceLanguage !== "auto"
      ? `from ${data.sourceLanguage} `
      : "";
    const system = `You are a professional translator. Translate the user's text ${source}into ${data.targetLanguage}. Preserve formatting, line breaks, markdown, character names and speaker labels. Return only the translated text, no commentary.`;

    const res = await fetch(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "qwen-mt-turbo",
          messages: [
            { role: "system", content: system },
            { role: "user", content: data.text },
          ],
        }),
      },
    );
    if (!res.ok) {
      // Fallback to qwen-plus if the MT model isn't available on this region.
      const fallback = await fetch(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "qwen-plus",
            messages: [
              { role: "system", content: system },
              { role: "user", content: data.text },
            ],
          }),
        },
      );
      if (!fallback.ok) {
        const txt = await fallback.text();
        throw new Error(`Qwen translate failed (${fallback.status}): ${txt.slice(0, 300)}`);
      }
      const j = (await fallback.json()) as { choices?: { message?: { content?: string } }[] };
      const translated = j.choices?.[0]?.message?.content ?? "";
      await logTr(context, data.projectId, "qwen-plus", t0);
      return { translated, provider: "qwen-plus", durationMs: Date.now() - t0 };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const translated = json.choices?.[0]?.message?.content ?? "";
    await logTr(context, data.projectId, "qwen-mt-turbo", t0);
    return { translated, provider: "qwen-mt-turbo", durationMs: Date.now() - t0 };
  });

async function logTr(context: { supabase: { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } }; userId: string }, projectId: string | undefined, provider: string, t0: number) {
  try {
    await context.supabase.from("generation_history").insert({
      user_id: context.userId,
      project_id: projectId ?? null,
      asset_type: "translation",
      provider,
      status: "completed",
      duration_ms: Date.now() - t0,
      credits_used: 1,
    });
  } catch { /* best-effort */ }
}
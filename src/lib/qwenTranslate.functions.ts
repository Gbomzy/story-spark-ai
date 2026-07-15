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
    const { beginCharge } = await import("./creditsInHandler.server");
    const units = Math.max(1, Math.ceil(data.text.length / 1000));
    const charge = await beginCharge({ userId: context.userId, operation: "translation", units, projectId: data.projectId ?? null });

    const sourceLanguage = data.sourceLanguage && data.sourceLanguage !== "auto" ? data.sourceLanguage : "auto";

    const res = await fetch(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "qwen-mt-flash",
          messages: [{ role: "user", content: data.text }],
          translation_options: { source_lang: sourceLanguage, target_lang: data.targetLanguage },
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      await charge.refund(`translate_http_${res.status}`);
      throw new Error(`Qwen translate failed (${res.status}): ${txt.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const translated = json.choices?.[0]?.message?.content ?? "";
    {
      const { recordGenerationHistory } = await import("./generationHistory.server");
      await recordGenerationHistory({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        asset_type: "translation",
        provider: "qwen-mt-flash",
        status: "completed",
        duration_ms: Date.now() - t0,
        credits_used: 1,
      });
    }
    await charge.commit("qwen-mt-flash");
    return { translated, provider: "qwen-mt-flash", durationMs: Date.now() - t0, creditsUsed: charge.credits };
  });
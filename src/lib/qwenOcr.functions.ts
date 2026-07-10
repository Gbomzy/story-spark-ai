import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  preserveLayout: z.boolean().optional(),
  projectId: z.string().optional(),
});

/** Qwen-VL OCR via DashScope OpenAI-compatible chat completions. */
export const qwenOcr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
    if (!apiKey) throw new Error("QWEN_API_KEY / DASHSCOPE_API_KEY is not configured.");
    if (!data.imageUrl && !data.imageBase64) throw new Error("Provide imageUrl or imageBase64.");

    const t0 = Date.now();
    const imageValue = data.imageUrl
      ? data.imageUrl
      : `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`;

    const instruction = data.preserveLayout
      ? "Extract ALL visible text from this image. Preserve original layout, line breaks, columns, tables and reading order. Return only the extracted text, no commentary."
      : "Extract ALL visible text from this image. Return only the extracted text, no commentary.";

    const res = await fetch(
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "qwen-vl-ocr-2025-11-20",
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: imageValue } },
                { type: "text", text: instruction },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Qwen OCR failed (${res.status}): ${txt.slice(0, 400)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";

    try {
      await context.supabase.from("generation_history").insert({
        user_id: context.userId,
        project_id: data.projectId ?? null,
        asset_type: "ocr",
        provider: "qwen-vl-ocr-2025-11-20",
        status: "completed",
        duration_ms: Date.now() - t0,
        credits_used: 1,
        metadata: { chars: text.length },
      });
    } catch { /* best-effort */ }

    return { text, provider: "qwen-vl-ocr-2025-11-20", durationMs: Date.now() - t0 };
  });
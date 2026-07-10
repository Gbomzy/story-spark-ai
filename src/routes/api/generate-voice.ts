import { createFileRoute } from "@tanstack/react-router";

// Voice narration via Lovable AI Gateway (openai/gpt-4o-mini-tts).
// Returns MP3 as a base64 data URL so the client can play + download it
// without extra plumbing.
export const Route = createFileRoute("/api/generate-voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json(
            { error: "Voice provider not configured (missing LOVABLE_API_KEY)." },
            { status: 503 },
          );
        }
        const body = (await request.json().catch(() => null)) as
          | { script?: string; voice?: string; speed?: number }
          | null;
        const script = body?.script?.trim();
        if (!script) return Response.json({ error: "Missing script" }, { status: 400 });

        const started = Date.now();
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            voice: body?.voice ?? "alloy",
            input: script.slice(0, 4000),
            response_format: "mp3",
            speed: body?.speed ?? 1,
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return Response.json(
            { error: `Voice generation failed (${upstream.status})`, detail: text.slice(0, 500) },
            { status: upstream.status },
          );
        }

        const buf = new Uint8Array(await upstream.arrayBuffer());
        // Base64-encode in chunks to avoid stack overflow on large buffers.
        let binary = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < buf.length; i += CHUNK) {
          binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
        }
        const b64 = btoa(binary);

        return Response.json({
          url: `data:audio/mpeg;base64,${b64}`,
          provider: "lovable:openai/gpt-4o-mini-tts",
          durationMs: Date.now() - started,
          bytes: buf.length,
        });
      },
    },
  },
});
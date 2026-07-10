import { createFileRoute } from "@tanstack/react-router";

// Server route that proxies image generation through the Lovable AI Gateway.
// Non-streaming JSON response — the client persists the returned base64 PNG
// as a data URL on the scene. Kept as a raw HTTP endpoint (not a server fn)
// so the body is opaque to the RPC transport.
export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return Response.json(
            { error: "Image provider not configured (missing LOVABLE_API_KEY)." },
            { status: 503 },
          );
        }
        const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
        const prompt = body?.prompt?.trim();
        if (!prompt) {
          return Response.json({ error: "Missing prompt" }, { status: 400 });
        }

        const started = Date.now();
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return Response.json(
            { error: `Image generation failed (${upstream.status})`, detail: text.slice(0, 500) },
            { status: upstream.status },
          );
        }

        const payload = (await upstream.json().catch(() => null)) as
          | { data?: Array<{ b64_json?: string }>; usage?: { total_tokens?: number } }
          | null;
        const b64 = payload?.data?.[0]?.b64_json;
        if (!b64) {
          return Response.json({ error: "Provider returned no image" }, { status: 502 });
        }

        return Response.json({
          url: `data:image/png;base64,${b64}`,
          provider: "lovable:google/gemini-3.1-flash-image",
          durationMs: Date.now() - started,
          creditsUsed: payload?.usage?.total_tokens ?? 0,
        });
      },
    },
  },
});
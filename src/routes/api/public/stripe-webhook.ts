import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook — credits are only granted after Stripe confirms payment.
 * Verifies the Stripe-Signature header via HMAC-SHA256 (timing-safe).
 */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const signature = request.headers.get("stripe-signature") ?? "";
        const rawBody = await request.text();

        // Stripe signature format: t=timestamp,v1=hash,...
        const parts = Object.fromEntries(signature.split(",").map((p) => p.split("=")) as [string, string][]);
        const t = parts.t;
        const v1 = parts.v1;
        if (!t || !v1) return new Response("Invalid signature", { status: 400 });

        const { createHmac, timingSafeEqual } = await import("crypto");
        const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
        const a = Buffer.from(v1);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(rawBody) as {
          type: string;
          data: { object: Record<string, unknown> };
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (event.type === "checkout.session.completed") {
          const s = event.data.object as {
            id: string;
            payment_intent?: string;
            client_reference_id?: string;
            metadata?: { purchase_id?: string; user_id?: string; credits?: string };
            payment_status?: string;
          };
          if (s.payment_status !== "paid") return new Response("ok");
          const purchaseId = s.metadata?.purchase_id ?? s.client_reference_id;
          if (!purchaseId) return new Response("Missing purchase id", { status: 400 });

          const { data: purchase } = await supabaseAdmin
            .from("credit_purchases")
            .select("*")
            .eq("id", purchaseId)
            .maybeSingle();
          if (!purchase) return new Response("Unknown purchase", { status: 404 });
          if (purchase.status === "completed") return new Response("ok"); // idempotent

          await supabaseAdmin.rpc("credit_grant", {
            _user: purchase.user_id,
            _credits: purchase.credits,
            _reason: `Stripe purchase ${s.id}`,
            _kind: "topup",
            _ref: purchaseId,
          });
          await supabaseAdmin
            .from("credit_purchases")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              provider_session_id: s.id,
              provider_payment_id: s.payment_intent ?? null,
            })
            .eq("id", purchaseId);
          return new Response("ok");
        }

        if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
          const s = event.data.object as { metadata?: { purchase_id?: string }; client_reference_id?: string };
          const purchaseId = s.metadata?.purchase_id ?? s.client_reference_id;
          if (purchaseId) {
            await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchaseId);
          }
          return new Response("ok");
        }

        return new Response("ok");
      },
    },
  },
});
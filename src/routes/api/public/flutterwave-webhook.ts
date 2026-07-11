import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.FLUTTERWAVE_SECRET_HASH;
        if (!secret) return new Response("Not configured", { status: 503 });
        if ((request.headers.get("verif-hash") ?? "") !== secret) return new Response("Invalid signature", { status: 401 });

        const rawBody = await request.text();
        const event = JSON.parse(rawBody) as { event?: string; data: Record<string, unknown> };
        const type = event.event ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (type === "charge.completed" || type === "payment.completed") {
          const d = event.data as { id: number; tx_ref: string; status: string; amount: number; currency: string; meta?: { purchase_id?: string; subscription_id?: string; user_id?: string; credits?: number; kind?: string; plan_id?: string; billing_cycle?: "monthly" | "yearly" } };
          if (d.status !== "successful") return new Response("ok");
          const { flutterwaveVerifyTransaction } = await import("@/lib/payments/flutterwave.server");
          const verified = await flutterwaveVerifyTransaction(d.id);
          if (!verified || verified.status !== "successful") return new Response("Unverified", { status: 400 });

          const kind = d.meta?.kind;
          if (kind === "credit_pack" && d.meta?.purchase_id) {
            const { data: p } = await supabaseAdmin.from("credit_purchases").select("*").eq("id", d.meta.purchase_id).maybeSingle();
            if (!p) return new Response("Unknown purchase", { status: 404 });
            if (p.status === "completed") return new Response("ok");
            await supabaseAdmin.rpc("credit_grant", { _user: p.user_id, _credits: p.credits, _reason: `Flutterwave ${d.tx_ref}`, _kind: "topup", _ref: p.id });
            await supabaseAdmin.from("credit_purchases").update({ status: "completed", completed_at: new Date().toISOString(), provider_payment_id: String(d.id), provider_session_id: d.tx_ref }).eq("id", p.id);
            await supabaseAdmin.from("invoices").insert({ user_id: p.user_id, purchase_id: p.id, provider: "flutterwave", provider_invoice_id: String(d.id), provider_reference: d.tx_ref, kind: "credit_pack", amount_cents: p.amount_cents, currency: p.currency, status: "paid", description: `${p.credits} credits` });
          } else if (kind === "subscription" && d.meta?.subscription_id) {
            const now = new Date();
            const period = d.meta.billing_cycle === "yearly" ? 365 : 30;
            const periodEnd = new Date(now.getTime() + period * 24 * 3600 * 1000);
            await supabaseAdmin.from("user_subscriptions").update({ status: "active", current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(), cancel_at_period_end: false, cancelled_at: null, provider: "flutterwave" }).eq("id", d.meta.subscription_id);
            const { data: sub } = await supabaseAdmin.from("user_subscriptions").select("user_id, plan_id, plan:subscription_plans(monthly_credits)").eq("id", d.meta.subscription_id).maybeSingle();
            const monthlyCredits = (sub as unknown as { plan?: { monthly_credits?: number } } | null)?.plan?.monthly_credits ?? 0;
            if (sub?.user_id && monthlyCredits > 0) {
              await supabaseAdmin.rpc("credit_grant", { _user: sub.user_id, _credits: monthlyCredits, _reason: `Subscription ${sub.plan_id}`, _kind: "subscription", _ref: d.meta.subscription_id });
            }
            if (sub?.user_id) {
              await supabaseAdmin.from("invoices").insert({ user_id: sub.user_id, subscription_id: d.meta.subscription_id, provider: "flutterwave", provider_invoice_id: String(d.id), provider_reference: d.tx_ref, kind: "subscription", amount_cents: Math.round(verified.amount * 100), currency: verified.currency, status: "paid", description: `${sub.plan_id} (${d.meta.billing_cycle})` });
            }
          }
          return new Response("ok");
        }

        if (type === "subscription.cancelled") {
          const d = event.data as { id?: string };
          if (d.id) await supabaseAdmin.from("user_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("provider_subscription_id", String(d.id));
          return new Response("ok");
        }

        return new Response("ok");
      },
    },
  },
});
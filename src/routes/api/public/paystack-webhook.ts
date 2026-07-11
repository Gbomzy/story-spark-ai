import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (!key) return new Response("Not configured", { status: 503 });
        const rawBody = await request.text();
        const sig = request.headers.get("x-paystack-signature") ?? "";
        const { createHmac, timingSafeEqual } = await import("crypto");
        const expected = createHmac("sha512", key).update(rawBody).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(rawBody) as { event: string; data: Record<string, unknown> };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (event.event === "charge.success") {
          const d = event.data as { reference: string; amount: number; currency: string; id: number; metadata?: { purchase_id?: string; subscription_id?: string; user_id?: string; credits?: number; kind?: string; plan_id?: string; billing_cycle?: "monthly" | "yearly" } };
          const kind = d.metadata?.kind;
          if (kind === "credit_pack" && d.metadata?.purchase_id) {
            const { data: p } = await supabaseAdmin.from("credit_purchases").select("*").eq("id", d.metadata.purchase_id).maybeSingle();
            if (!p) return new Response("Unknown purchase", { status: 404 });
            if (p.status === "completed") return new Response("ok");
            await supabaseAdmin.rpc("credit_grant", { _user: p.user_id, _credits: p.credits, _reason: `Paystack ${d.reference}`, _kind: "topup", _ref: p.id });
            await supabaseAdmin.from("credit_purchases").update({ status: "completed", completed_at: new Date().toISOString(), provider_payment_id: String(d.id), provider_session_id: d.reference }).eq("id", p.id);
            await supabaseAdmin.from("invoices").insert({ user_id: p.user_id, purchase_id: p.id, provider: "paystack", provider_invoice_id: String(d.id), provider_reference: d.reference, kind: "credit_pack", amount_cents: p.amount_cents, currency: p.currency, status: "paid", description: `${p.credits} credits` });
          } else if (kind === "subscription" && d.metadata?.subscription_id) {
            const now = new Date();
            const period = d.metadata.billing_cycle === "yearly" ? 365 : 30;
            const periodEnd = new Date(now.getTime() + period * 24 * 3600 * 1000);
            await supabaseAdmin.from("user_subscriptions").update({ status: "active", current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(), cancel_at_period_end: false, cancelled_at: null, provider: "paystack" }).eq("id", d.metadata.subscription_id);
            const { data: sub } = await supabaseAdmin.from("user_subscriptions").select("user_id, plan_id, plan:subscription_plans(monthly_credits)").eq("id", d.metadata.subscription_id).maybeSingle();
            const monthlyCredits = (sub as unknown as { plan?: { monthly_credits?: number } } | null)?.plan?.monthly_credits ?? 0;
            if (sub?.user_id && monthlyCredits > 0) {
              await supabaseAdmin.rpc("credit_grant", { _user: sub.user_id, _credits: monthlyCredits, _reason: `Subscription ${sub.plan_id}`, _kind: "subscription", _ref: d.metadata.subscription_id });
            }
            if (sub?.user_id) {
              await supabaseAdmin.from("invoices").insert({ user_id: sub.user_id, subscription_id: d.metadata.subscription_id, provider: "paystack", provider_invoice_id: String(d.id), provider_reference: d.reference, kind: "subscription", amount_cents: d.amount, currency: d.currency, status: "paid", description: `${sub.plan_id} (${d.metadata.billing_cycle})` });
            }
          }
          return new Response("ok");
        }

        if (event.event === "subscription.disable" || event.event === "subscription.not_renew") {
          const d = event.data as { subscription_code?: string };
          if (d.subscription_code) {
            await supabaseAdmin.from("user_subscriptions").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("provider_subscription_id", d.subscription_code);
          }
          return new Response("ok");
        }

        if (event.event === "invoice.payment_failed") {
          const d = event.data as { subscription?: { subscription_code?: string } };
          if (d.subscription?.subscription_code) {
            await supabaseAdmin.from("user_subscriptions").update({ status: "past_due" }).eq("provider_subscription_id", d.subscription.subscription_code);
          }
          return new Response("ok");
        }

        if (event.event === "refund.processed") {
          const d = event.data as { transaction_reference?: string; amount?: number; currency?: string };
          if (d.transaction_reference) {
            const { data: p } = await supabaseAdmin.from("credit_purchases").select("*").eq("provider_reference", d.transaction_reference).maybeSingle();
            if (p) {
              await supabaseAdmin.from("credit_purchases").update({ status: "refunded" }).eq("id", p.id);
              await supabaseAdmin.rpc("credit_refund", { _user: p.user_id, _operation: "refund", _credits: p.credits, _ref: p.id, _reason: "Paystack refund" });
              await supabaseAdmin.from("refunds").insert({ user_id: p.user_id, purchase_id: p.id, provider: "paystack", provider_refund_id: d.transaction_reference, amount_cents: d.amount ?? p.amount_cents, currency: d.currency ?? p.currency, credits_reversed: p.credits, reason: "Provider refund", status: "processed" });
            }
          }
          return new Response("ok");
        }

        return new Response("ok");
      },
    },
  },
});
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Zap, Check, Loader2, ArrowUpRight, Coins, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyWallet,
  listMyTransactions,
  getMySubscription,
  listPlans,
  startCreditPurchase,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({ meta: [{ title: "Billing — StorySpark AI" }] }),
  component: BillingPage,
});

const PACKS: Array<{ credits: 500 | 1000 | 2500 | 5000 | 10000; price: string; bonus?: string }> = [
  { credits: 500, price: "$5" },
  { credits: 1000, price: "$9", bonus: "10% off" },
  { credits: 2500, price: "$19", bonus: "Best value" },
  { credits: 5000, price: "$35" },
  { credits: 10000, price: "$60" },
];

function BillingPage() {
  const qc = useQueryClient();
  const wallet = useQuery({ queryKey: ["billing", "wallet"], queryFn: () => getMyWallet() });
  const txs = useQuery({ queryKey: ["billing", "txs"], queryFn: () => listMyTransactions({ data: { limit: 50 } }) });
  const sub = useQuery({ queryKey: ["billing", "sub"], queryFn: () => getMySubscription() });
  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: () => listPlans() });

  useEffect(() => {
    const ch = supabase
      .channel("billing-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_wallet" }, () =>
        qc.invalidateQueries({ queryKey: ["billing"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "credit_transactions" }, () =>
        qc.invalidateQueries({ queryKey: ["billing", "txs"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const buy = useMutation({
    mutationFn: (pack: 500 | 1000 | 2500 | 5000 | 10000) => startCreditPurchase({ data: { pack } }),
    onSuccess: (res) => {
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else toast.info("Stripe is not connected yet. Ask an admin to enable payments to complete this purchase.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Purchase failed"),
  });

  const w = wallet.data;
  const available = (w?.balance ?? 0) - (w?.reserved ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Credits" description="Manage your subscription, buy credits, and review usage." />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white shadow-glow"><Wallet className="h-4 w-4" /></div>
          <p className="text-2xl font-bold tabular-nums">{available.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Available credits</p>
        </Card>
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500"><Coins className="h-4 w-4" /></div>
          <p className="text-2xl font-bold tabular-nums">{(w?.reserved ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Reserved</p>
        </Card>
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500"><TrendingUp className="h-4 w-4" /></div>
          <p className="text-2xl font-bold tabular-nums">{(w?.lifetime_used ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Lifetime used</p>
        </Card>
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Zap className="h-4 w-4" /></div>
          <p className="text-2xl font-bold tabular-nums">{(w?.lifetime_purchased ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Lifetime purchased</p>
        </Card>
      </div>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Current plan</h3>
            <p className="text-xs text-muted-foreground">
              {sub.data?.plan?.name ?? "Free"} · renews {sub.data?.current_period_end ? new Date(sub.data.current_period_end).toLocaleDateString() : "—"}
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full">{sub.data?.status ?? "active"}</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {plans.data?.map((p) => {
            const current = sub.data?.plan_id === p.id;
            return (
              <div key={p.id} className={`rounded-2xl border p-4 ${current ? "border-primary bg-primary/5" : "border-border bg-card/60"}`}>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="mt-1 text-2xl font-bold">${(p.price_cents / 100).toFixed(0)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground">{p.monthly_credits.toLocaleString()} credits/mo</p>
                <ul className="mt-3 space-y-1 text-xs">
                  {(Array.isArray(p.features) ? p.features : []).slice(0, 3).map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" /><span>{String(f)}</span></li>
                  ))}
                </ul>
                <Button size="sm" variant={current ? "secondary" : "default"} disabled={current} className="mt-3 w-full rounded-xl">
                  {current ? "Current" : "Upgrade"}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-3 font-semibold">Buy extra credits</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PACKS.map((p) => (
            <button
              key={p.credits}
              onClick={() => buy.mutate(p.credits)}
              disabled={buy.isPending}
              className="group rounded-2xl border border-border bg-card/60 p-4 text-left transition hover:border-primary hover:bg-card"
            >
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold tabular-nums">{p.credits.toLocaleString()}</p>
                {p.bonus && <Badge variant="secondary" className="rounded-full text-[10px]">{p.bonus}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">credits</p>
              <p className="mt-2 text-sm font-semibold text-primary">{p.price}</p>
              <div className="mt-2 inline-flex items-center text-xs text-muted-foreground group-hover:text-foreground">
                {buy.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ArrowUpRight className="mr-1 h-3 w-3" />}
                Buy now
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Transaction history</h3>
          <Link to="/credits" className="text-xs text-primary hover:underline">View analytics</Link>
        </div>
        {(txs.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="max-h-96 space-y-1.5 overflow-auto">
            {txs.data!.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">{t.operation}</span>
                  <span className="truncate text-muted-foreground">{t.reason ?? t.status}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`font-semibold tabular-nums ${t.credits < 0 ? "text-destructive" : "text-emerald-500"}`}>
                    {t.credits > 0 ? "+" : ""}{t.credits}
                  </span>
                  <span className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
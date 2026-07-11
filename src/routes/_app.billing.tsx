import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Zap, Check, Coins, TrendingUp, Receipt, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyWallet,
  listMyTransactions,
  getMySubscription,
  listPlans,
  listCreditPacks,
  listAvailableProviders,
  listMyInvoices,
  listMyPayments,
  startCreditPurchase,
  startSubscription,
  cancelMySubscription,
} from "@/lib/billing.functions";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({ meta: [{ title: "Billing — StorySpark AI" }] }),
  component: BillingPage,
});

type ProviderId = "paystack" | "flutterwave" | "stripe";

function fmt(cents: number, currency = "NGN") {
  const value = cents / 100;
  try { return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${currency} ${value.toLocaleString()}`; }
}

function BillingPage() {
  const qc = useQueryClient();
  const wallet = useQuery({ queryKey: ["billing", "wallet"], queryFn: () => getMyWallet() });
  const txs = useQuery({ queryKey: ["billing", "txs"], queryFn: () => listMyTransactions({ data: { limit: 100 } }) });
  const sub = useQuery({ queryKey: ["billing", "sub"], queryFn: () => getMySubscription() });
  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: () => listPlans() });
  const packs = useQuery({ queryKey: ["billing", "packs"], queryFn: () => listCreditPacks() });
  const providers = useQuery({ queryKey: ["billing", "providers"], queryFn: () => listAvailableProviders() });
  const invoices = useQuery({ queryKey: ["billing", "invoices"], queryFn: () => listMyInvoices() });
  const payments = useQuery({ queryKey: ["billing", "payments"], queryFn: () => listMyPayments() });

  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [provider, setProvider] = useState<ProviderId>("paystack");
  const [tab, setTab] = useState<"plans" | "packs" | "usage" | "payments" | "invoices">("plans");

  useEffect(() => {
    if (providers.data && providers.data.length && !providers.data.includes(provider)) {
      setProvider(providers.data[0] as ProviderId);
    }
  }, [providers.data, provider]);

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
    mutationFn: (packId: string) => startCreditPurchase({ data: { packId, provider } }),
    onSuccess: (res) => {
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else toast.info(`${provider} is not fully configured yet. Ask an admin to add the API keys.`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Purchase failed"),
  });

  const subscribe = useMutation({
    mutationFn: (planId: string) => startSubscription({ data: { planId, billingCycle: cycle, provider } }),
    onSuccess: (res) => {
      if ("freePlan" in res && res.freePlan) { toast.success("Free plan activated"); qc.invalidateQueries({ queryKey: ["billing"] }); return; }
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else toast.info(`${provider} is not fully configured yet. Ask an admin to add the API keys.`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Subscription failed"),
  });

  const cancel = useMutation({
    mutationFn: () => cancelMySubscription({ data: { immediate: false } }),
    onSuccess: () => { toast.success("Subscription will cancel at period end"); qc.invalidateQueries({ queryKey: ["billing"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Cancel failed"),
  });

  const w = wallet.data;
  const available = (w?.balance ?? 0) - (w?.reserved ?? 0);
  const currentPlanId = sub.data?.plan_id ?? "free";
  const providerList: ProviderId[] = (providers.data as ProviderId[] | undefined) ?? [];

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

      <Card className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 shadow-soft">
        <div className="flex items-center gap-2 text-sm">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Pay with</span>
          {providerList.length === 0 && <Badge variant="outline">No payment provider configured</Badge>}
          {providerList.map((p) => (
            <Button key={p} size="sm" variant={provider === p ? "default" : "outline"} onClick={() => setProvider(p)} className="capitalize">{p}</Button>
          ))}
        </div>
        <div className="flex gap-1 rounded-full border border-border p-1">
          {(["plans","packs","usage","payments","invoices"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs capitalize ${tab === t ? "gradient-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
      </Card>

      {tab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Billing cycle</span>
            <Button size="sm" variant={cycle === "monthly" ? "default" : "outline"} onClick={() => setCycle("monthly")}>Monthly</Button>
            <Button size="sm" variant={cycle === "yearly" ? "default" : "outline"} onClick={() => setCycle("yearly")}>Yearly <Badge className="ml-2" variant="secondary">−20%</Badge></Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(plans.data ?? []).map((p) => {
              const price = cycle === "yearly" ? p.price_yearly_cents : p.price_cents;
              const isCurrent = currentPlanId === p.id;
              const features = Array.isArray(p.features) ? (p.features as string[]) : [];
              return (
                <Card key={p.id} className={`glass rounded-3xl p-5 shadow-soft ${isCurrent ? "ring-2 ring-primary" : ""}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <p className="mb-1 text-2xl font-bold tabular-nums">{fmt(price, p.currency)}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{cycle === "yearly" ? "per year" : "per month"} · {p.monthly_credits.toLocaleString()} credits/mo</p>
                  <ul className="mb-4 space-y-1 text-xs">
                    {features.map((f, i) => <li key={i} className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" />{f}</li>)}
                  </ul>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || subscribe.isPending}
                    onClick={() => subscribe.mutate(p.id)}
                  >
                    {isCurrent ? "Active" : p.price_cents === 0 ? "Downgrade" : "Choose"}
                  </Button>
                </Card>
              );
            })}
          </div>
          {sub.data && sub.data.status === "active" && sub.data.plan_id !== "free" && !sub.data.cancel_at_period_end && (
            <Button variant="ghost" size="sm" onClick={() => cancel.mutate()} className="text-destructive">Cancel subscription at period end</Button>
          )}
          {sub.data?.cancel_at_period_end && (
            <p className="text-xs text-amber-500">Cancellation scheduled for {sub.data.current_period_end?.slice(0, 10)}</p>
          )}
        </div>
      )}

      {tab === "packs" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {(packs.data ?? []).map((pack) => (
            <Card key={pack.id} className="glass rounded-3xl p-5 shadow-soft">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">{pack.name}</h4>
                {pack.bonus_label && <Badge variant="secondary">{pack.bonus_label}</Badge>}
              </div>
              <p className="text-2xl font-bold tabular-nums">{fmt(pack.price_cents, pack.currency)}</p>
              <p className="mb-3 text-xs text-muted-foreground">{pack.credits.toLocaleString()} credits</p>
              <Button size="sm" className="w-full" disabled={buy.isPending} onClick={() => buy.mutate(pack.id)}>Buy</Button>
            </Card>
          ))}
        </div>
      )}

      {tab === "usage" && (
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <h3 className="mb-3 font-semibold">Credit usage</h3>
          <div className="space-y-1 text-sm">
            {(txs.data ?? []).length === 0 && <p className="text-muted-foreground text-xs">No activity yet.</p>}
            {(txs.data ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{t.operation}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.reason ?? "—"} · {new Date(t.created_at).toLocaleString()}</p>
                </div>
                <span className={`tabular-nums font-medium ${t.credits < 0 ? "text-destructive" : "text-emerald-500"}`}>{t.credits > 0 ? "+" : ""}{t.credits}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "payments" && (
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <h3 className="mb-3 font-semibold">Payment history</h3>
          <div className="space-y-1 text-sm">
            {(payments.data ?? []).length === 0 && <p className="text-muted-foreground text-xs">No payments yet.</p>}
            {(payments.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{fmt(p.amount_cents, p.currency)} · {p.credits.toLocaleString()} credits</p>
                  <p className="truncate text-xs text-muted-foreground">{p.provider} · {new Date(p.created_at).toLocaleString()}</p>
                </div>
                <Badge variant={p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "outline"}>{p.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "invoices" && (
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <h3 className="mb-3 font-semibold">Invoices</h3>
          <div className="space-y-1 text-sm">
            {(invoices.data ?? []).length === 0 && <p className="text-muted-foreground text-xs">No invoices yet.</p>}
            {(invoices.data ?? []).map((iv) => (
              <div key={iv.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm"><Receipt className="mr-1 inline h-3 w-3" />{iv.description ?? iv.kind}</p>
                  <p className="truncate text-xs text-muted-foreground">{iv.provider} · {new Date(iv.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm font-medium">{fmt(iv.amount_cents, iv.currency)}</span>
                  <Badge variant={iv.status === "paid" ? "default" : "outline"}>{iv.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  adminMetrics, isAdmin, listCosts, adminUpdateCost,
  adminListSubscriptions, adminListPayments, adminListCustomers,
  adminListRefunds, adminListCoupons, adminUpsertCoupon, adminUpsertPack,
  adminGrantCredits, adminDebitCredits, adminIssueRefund,
  listCreditPacks, listPlans,
} from "@/lib/billing.functions";
import { DollarSign, TrendingUp, Users, XCircle, AlertTriangle, Coins } from "lucide-react";

export const Route = createFileRoute("/_app/admin-billing")({
  head: () => ({ meta: [{ title: "Admin Billing — StorySpark AI" }] }),
  component: AdminBillingPage,
});

type Tab = "revenue" | "customers" | "subscriptions" | "payments" | "ledger" | "refunds" | "coupons" | "catalog";

function AdminBillingPage() {
  const qc = useQueryClient();
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
  const enabled = admin.data?.admin === true;
  const [tab, setTab] = useState<Tab>("revenue");

  const metrics = useQuery({ queryKey: ["admin-metrics"], queryFn: () => adminMetrics(), enabled });
  const costs = useQuery({ queryKey: ["admin-costs"], queryFn: () => listCosts(), enabled });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => listPlans(), enabled });
  const packs = useQuery({ queryKey: ["admin-packs"], queryFn: () => listCreditPacks(), enabled });
  const subs = useQuery({ queryKey: ["admin-subs"], queryFn: () => adminListSubscriptions(), enabled: enabled && tab === "subscriptions" });
  const payments = useQuery({ queryKey: ["admin-payments"], queryFn: () => adminListPayments(), enabled: enabled && tab === "payments" });
  const customers = useQuery({ queryKey: ["admin-customers"], queryFn: () => adminListCustomers(), enabled: enabled && tab === "customers" });
  const refunds = useQuery({ queryKey: ["admin-refunds"], queryFn: () => adminListRefunds(), enabled: enabled && tab === "refunds" });
  const coupons = useQuery({ queryKey: ["admin-coupons"], queryFn: () => adminListCoupons(), enabled: enabled && tab === "coupons" });

  const [costEdits, setCostEdits] = useState<Record<string, number>>({});
  const updateCost = useMutation({
    mutationFn: (v: { operation: string; credits: number }) => adminUpdateCost({ data: v }),
    onSuccess: () => { toast.success("Cost updated"); qc.invalidateQueries({ queryKey: ["admin-costs"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const [grantForm, setGrantForm] = useState<{ userId: string; credits: number; reason: string }>({ userId: "", credits: 100, reason: "" });
  const grant = useMutation({
    mutationFn: () => adminGrantCredits({ data: grantForm }),
    onSuccess: () => { toast.success("Credited"); qc.invalidateQueries({ queryKey: ["admin-customers"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Grant failed"),
  });
  const debit = useMutation({
    mutationFn: () => adminDebitCredits({ data: grantForm }),
    onSuccess: () => { toast.success("Debited"); qc.invalidateQueries({ queryKey: ["admin-customers"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Debit failed"),
  });

  const refund = useMutation({
    mutationFn: (v: { purchaseId: string; reason: string }) => adminIssueRefund({ data: v }),
    onSuccess: () => { toast.success("Refunded"); qc.invalidateQueries({ queryKey: ["admin-payments"] }); qc.invalidateQueries({ queryKey: ["admin-refunds"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Refund failed"),
  });

  const [couponDraft, setCouponDraft] = useState<{ code: string; percent_off?: number; amount_off_cents?: number; bonus_credits: number; applies_to: "subscription" | "credit_pack" | "both" }>({ code: "", bonus_credits: 0, applies_to: "both" });
  const saveCoupon = useMutation({
    mutationFn: () => adminUpsertCoupon({ data: { ...couponDraft, is_active: true } }),
    onSuccess: () => { toast.success("Coupon saved"); setCouponDraft({ code: "", bonus_credits: 0, applies_to: "both" }); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const [packDraft, setPackDraft] = useState<{ name: string; credits: number; price_cents: number; currency: string; sort_order: number }>({ name: "", credits: 500, price_cents: 200000, currency: "NGN", sort_order: 10 });
  const savePack = useMutation({
    mutationFn: () => adminUpsertPack({ data: { ...packDraft, is_active: true } }),
    onSuccess: () => { toast.success("Pack saved"); qc.invalidateQueries({ queryKey: ["admin-packs"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  if (admin.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!admin.data?.admin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Admin Billing" description="Restricted to admin users." />
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">You do not have admin access.</p>
        </Card>
      </div>
    );
  }
  const m = metrics.data;
  const TABS: Tab[] = ["revenue","customers","subscriptions","payments","ledger","refunds","coupons","catalog"];

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Billing" description="Revenue, customers, subscriptions, payments, ledger, refunds, coupons, catalog." />
      <div className="flex flex-wrap gap-1 rounded-full border border-border p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs capitalize ${tab === t ? "gradient-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "revenue" && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Metric icon={<DollarSign />} label="MRR" value={`₦${(m?.mrr ?? 0).toLocaleString()}`} />
          <Metric icon={<TrendingUp />} label="ARR" value={`₦${(m?.arr ?? 0).toLocaleString()}`} />
          <Metric icon={<DollarSign />} label="Revenue today" value={`₦${(m?.revenueToday ?? 0).toLocaleString()}`} />
          <Metric icon={<Users />} label="Active subs" value={String(m?.activeSubs ?? 0)} />
          <Metric icon={<XCircle />} label="Cancelled" value={String(m?.cancelled ?? 0)} />
          <Metric icon={<Coins />} label="Credits sold" value={(m?.creditsSold ?? 0).toLocaleString()} />
          <Metric icon={<Coins />} label="Credits used" value={(m?.creditsUsed ?? 0).toLocaleString()} />
          <Metric icon={<DollarSign />} label="ARPU" value={`₦${(m?.arpu ?? 0).toLocaleString()}`} />
          <Metric icon={<AlertTriangle />} label="Failed payments" value={String(m?.failedPayments ?? 0)} />
          <Metric icon={<DollarSign />} label="Revenue this month" value={`₦${(m?.revenueMonth ?? 0).toLocaleString()}`} />
        </div>
      )}

      {tab === "customers" && (
        <Card className="glass rounded-3xl p-5 shadow-soft space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col"><label className="text-xs text-muted-foreground">User ID (UUID)</label><Input value={grantForm.userId} onChange={(e) => setGrantForm((f) => ({ ...f, userId: e.target.value }))} className="w-64" /></div>
            <div className="flex flex-col"><label className="text-xs text-muted-foreground">Credits</label><Input type="number" value={grantForm.credits} onChange={(e) => setGrantForm((f) => ({ ...f, credits: Number(e.target.value) }))} className="w-32" /></div>
            <div className="flex flex-col flex-1 min-w-[200px]"><label className="text-xs text-muted-foreground">Reason</label><Input value={grantForm.reason} onChange={(e) => setGrantForm((f) => ({ ...f, reason: e.target.value }))} /></div>
            <Button size="sm" onClick={() => grant.mutate()} disabled={grant.isPending}>Credit</Button>
            <Button size="sm" variant="destructive" onClick={() => debit.mutate()} disabled={debit.isPending}>Debit</Button>
          </div>
          <div className="space-y-1 text-sm">
            <h4 className="font-semibold">Top customers by lifetime purchased</h4>
            {(customers.data ?? []).map((c) => (
              <div key={c.user_id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
                <span className="font-mono">{c.user_id}</span>
                <span>bal {c.balance} · used {c.lifetime_used} · bought {c.lifetime_purchased}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "subscriptions" && (
        <Card className="glass rounded-3xl p-5 shadow-soft space-y-1 text-sm">
          {(subs.data ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
              <span className="truncate">{s.user_id.slice(0,8)}… · {s.plan_id} · {s.billing_cycle}</span>
              <span>{s.status} · {s.provider ?? "—"} · renews {s.current_period_end?.slice(0,10)}</span>
            </div>
          ))}
          {(subs.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No subscriptions.</p>}
        </Card>
      )}

      {tab === "payments" && (
        <Card className="glass rounded-3xl p-5 shadow-soft space-y-1 text-sm">
          {(payments.data ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
              <span className="truncate">{p.user_id.slice(0,8)}… · {p.credits} credits · {(p.amount_cents/100).toLocaleString()} {p.currency}</span>
              <span className="flex items-center gap-2">
                <span>{p.provider} · {p.status}</span>
                {p.status === "completed" && <Button size="sm" variant="outline" onClick={() => refund.mutate({ purchaseId: p.id, reason: "Admin refund" })}>Refund</Button>}
              </span>
            </div>
          ))}
        </Card>
      )}

      {tab === "ledger" && (
        <Card className="glass rounded-3xl p-5 shadow-soft space-y-2">
          <h4 className="font-semibold">Cost catalog</h4>
          <div className="space-y-2">
            {costs.data?.map((c) => (
              <div key={c.operation} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
                <span className="w-48 truncate text-sm font-medium">{c.label}</span>
                <span className="w-40 truncate text-xs text-muted-foreground">{c.operation} · {c.category}</span>
                <Input type="number" className="w-28 rounded-xl" defaultValue={c.credits} onChange={(e) => setCostEdits((s) => ({ ...s, [c.operation]: Number(e.target.value) }))} />
                <Button size="sm" variant="outline" onClick={() => updateCost.mutate({ operation: c.operation, credits: costEdits[c.operation] ?? c.credits })} disabled={updateCost.isPending}>Save</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "refunds" && (
        <Card className="glass rounded-3xl p-5 shadow-soft space-y-1 text-sm">
          {(refunds.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
              <span className="truncate">{r.user_id.slice(0,8)}… · {(r.amount_cents/100).toLocaleString()} {r.currency}</span>
              <span>{r.provider} · {r.status} · {r.reason ?? "—"}</span>
            </div>
          ))}
          {(refunds.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No refunds yet.</p>}
        </Card>
      )}

      {tab === "coupons" && (
        <Card className="glass rounded-3xl p-5 shadow-soft space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div><label className="text-xs text-muted-foreground">Code</label><Input value={couponDraft.code} onChange={(e) => setCouponDraft((s) => ({ ...s, code: e.target.value.toUpperCase() }))} className="w-32" /></div>
            <div><label className="text-xs text-muted-foreground">% off</label><Input type="number" value={couponDraft.percent_off ?? ""} onChange={(e) => setCouponDraft((s) => ({ ...s, percent_off: e.target.value ? Number(e.target.value) : undefined }))} className="w-24" /></div>
            <div><label className="text-xs text-muted-foreground">Bonus credits</label><Input type="number" value={couponDraft.bonus_credits} onChange={(e) => setCouponDraft((s) => ({ ...s, bonus_credits: Number(e.target.value) }))} className="w-28" /></div>
            <Button size="sm" disabled={!couponDraft.code || saveCoupon.isPending} onClick={() => saveCoupon.mutate()}>Save coupon</Button>
          </div>
          <div className="space-y-1 text-sm">
            {(coupons.data ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
                <span className="font-mono">{c.code}</span>
                <span>{c.percent_off ? `${c.percent_off}% off` : c.amount_off_cents ? `${c.amount_off_cents/100} off` : ""} · +{c.bonus_credits} bonus · {c.redemptions}/{c.max_redemptions ?? "∞"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "catalog" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass rounded-3xl p-5 shadow-soft space-y-3">
            <h4 className="font-semibold">Credit packs</h4>
            {(packs.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
                <span>{p.name} · {p.credits} credits</span>
                <span>{(p.price_cents/100).toLocaleString()} {p.currency}</span>
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div><label className="text-xs text-muted-foreground">Name</label><Input value={packDraft.name} onChange={(e) => setPackDraft((s) => ({ ...s, name: e.target.value }))} className="w-40" /></div>
              <div><label className="text-xs text-muted-foreground">Credits</label><Input type="number" value={packDraft.credits} onChange={(e) => setPackDraft((s) => ({ ...s, credits: Number(e.target.value) }))} className="w-24" /></div>
              <div><label className="text-xs text-muted-foreground">Price (minor)</label><Input type="number" value={packDraft.price_cents} onChange={(e) => setPackDraft((s) => ({ ...s, price_cents: Number(e.target.value) }))} className="w-28" /></div>
              <Button size="sm" disabled={!packDraft.name || savePack.isPending} onClick={() => savePack.mutate()}>Add pack</Button>
            </div>
          </Card>
          <Card className="glass rounded-3xl p-5 shadow-soft space-y-1">
            <h4 className="font-semibold">Plans</h4>
            {(plans.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-xs">
                <span>{p.name}</span>
                <span>{(p.price_cents/100).toLocaleString()} {p.currency}/mo · {(p.price_yearly_cents/100).toLocaleString()}/yr · {p.monthly_credits} cr</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="glass rounded-3xl p-4 shadow-soft">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl gradient-primary text-white shadow-glow">{icon}</div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
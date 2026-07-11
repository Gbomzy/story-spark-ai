import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { adminMetrics, isAdmin, listCosts, adminUpdateCost } from "@/lib/billing.functions";
import { DollarSign, TrendingUp, Users, XCircle, AlertTriangle, Coins } from "lucide-react";

export const Route = createFileRoute("/_app/admin-billing")({
  head: () => ({ meta: [{ title: "Admin Billing — StorySpark AI" }] }),
  component: AdminBillingPage,
});

function AdminBillingPage() {
  const qc = useQueryClient();
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
  const metrics = useQuery({ queryKey: ["admin-metrics"], queryFn: () => adminMetrics(), enabled: admin.data?.admin === true });
  const costs = useQuery({ queryKey: ["costs"], queryFn: () => listCosts() });
  const [edits, setEdits] = useState<Record<string, number>>({});
  const update = useMutation({
    mutationFn: (v: { operation: string; credits: number }) => adminUpdateCost({ data: v }),
    onSuccess: () => { toast.success("Cost updated"); qc.invalidateQueries({ queryKey: ["costs"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
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

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Billing" description="Revenue, subscribers, credits, and cost catalog." />
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Metric icon={<DollarSign />} label="MRR" value={`$${(m?.mrr ?? 0).toFixed(2)}`} />
        <Metric icon={<TrendingUp />} label="ARR" value={`$${(m?.arr ?? 0).toFixed(2)}`} />
        <Metric icon={<DollarSign />} label="Revenue today" value={`$${(m?.revenueToday ?? 0).toFixed(2)}`} />
        <Metric icon={<Users />} label="Active subs" value={String(m?.activeSubs ?? 0)} />
        <Metric icon={<XCircle />} label="Cancelled" value={String(m?.cancelled ?? 0)} />
        <Metric icon={<Coins />} label="Credits sold" value={(m?.creditsSold ?? 0).toLocaleString()} />
        <Metric icon={<Coins />} label="Credits used" value={(m?.creditsUsed ?? 0).toLocaleString()} />
        <Metric icon={<DollarSign />} label="ARPU" value={`$${(m?.arpu ?? 0).toFixed(2)}`} />
        <Metric icon={<AlertTriangle />} label="Failed payments" value={String(m?.failedPayments ?? 0)} />
        <Metric icon={<DollarSign />} label="Revenue this month" value={`$${(m?.revenueMonth ?? 0).toFixed(2)}`} />
      </div>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-3 font-semibold">Cost catalog</h3>
        <div className="space-y-2">
          {costs.data?.map((c) => (
            <div key={c.operation} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3">
              <span className="w-48 truncate text-sm font-medium">{c.label}</span>
              <span className="w-40 truncate text-xs text-muted-foreground">{c.operation} · {c.category}</span>
              <Input
                type="number"
                className="w-28 rounded-xl"
                defaultValue={c.credits}
                onChange={(e) => setEdits((s) => ({ ...s, [c.operation]: Number(e.target.value) }))}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => update.mutate({ operation: c.operation, credits: edits[c.operation] ?? c.credits })}
                disabled={update.isPending}
              >
                Save
              </Button>
            </div>
          ))}
        </div>
      </Card>
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
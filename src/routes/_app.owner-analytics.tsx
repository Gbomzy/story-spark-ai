import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, HardDrive, Coins, Activity } from "lucide-react";
import { getOwnerAnalytics } from "@/lib/ownerAnalytics.functions";
import { formatDbError } from "@/lib/dbError";

export const Route = createFileRoute("/_app/owner-analytics")({
  head: () => ({ meta: [{ title: "Owner Analytics — StorySpark AI" }] }),
  component: OwnerAnalyticsPage,
});

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function OwnerAnalyticsPage() {
  const fetcher = useServerFn(getOwnerAnalytics);
  const q = useQuery({
    queryKey: ["owner-analytics"],
    queryFn: () => fetcher(),
    refetchInterval: 60000,
  });
  if (q.isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="p-8 text-sm text-destructive">{formatDbError(q.error, "Not authorized")}</div>;
  const d = q.data;
  if (!d) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Owner Analytics" description="Revenue, cost, and platform activity. Admin only." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric icon={<TrendingUp />} label="Revenue" value={fmtCents(d.revenueCents)} />
        <Metric icon={<DollarSign />} label="API cost" value={fmtCents(d.apiCostCents)} />
        <Metric icon={<TrendingUp />} label="Profit estimate" value={fmtCents(d.profitCents)} tone={d.profitCents >= 0 ? undefined : "destructive"} />
        <Metric icon={<Coins />} label="Credits sold" value={d.creditsSold.toLocaleString()} />
        <Metric icon={<Activity />} label="Credits consumed" value={d.creditsConsumed.toLocaleString()} />
        <Metric icon={<HardDrive />} label="Storage used" value={fmtBytes(d.storageBytes)} />
      </div>
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Most active users</h3>
        {d.activeUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2 text-left">User</th><th className="p-2 text-right">Credits consumed</th></tr>
            </thead>
            <tbody>
              {d.activeUsers.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="p-2">{u.display_name ?? u.user_id.slice(0, 8)}</td>
                  <td className="p-2 text-right tabular-nums">{u.consumed.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "destructive" }) {
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone === "destructive" ? "bg-destructive/15 text-destructive" : "gradient-primary text-white shadow-glow"}`}>{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
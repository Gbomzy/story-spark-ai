import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { isAdmin, listPlans } from "@/lib/billing.functions";
import {
  adminSearchUsers, adminApplyWalletAction, adminBulkWalletAction,
  adminGetUserActions, adminRecentActions,
} from "@/lib/adminWallet.functions";
import { Coins, Infinity as InfinityIcon, Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/admin-users")({
  head: () => ({ meta: [{ title: "Admin — User Wallets · StorySpark AI" }] }),
  component: AdminUsersPage,
});

type Action = "add" | "deduct" | "set" | "reset" | "unlimited_on" | "unlimited_off" | "beta_bonus";
type UserRow = Awaited<ReturnType<typeof adminSearchUsers>>[number];

function AdminUsersPage() {
  const qc = useQueryClient();
  const admin = useQuery({ queryKey: ["is-admin"], queryFn: () => isAdmin() });
  const enabled = admin.data?.admin === true;
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<UserRow | null>(null);
  const [pending, setPending] = useState<{ action: Action; amount: number; reason: string } | null>(null);

  const users = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => adminSearchUsers({ data: { query: q, limit: 100 } }),
    enabled,
  });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => listPlans(), enabled });
  const recent = useQuery({ queryKey: ["admin-actions-recent"], queryFn: () => adminRecentActions(), enabled });
  const userActions = useQuery({
    queryKey: ["admin-user-actions", focus?.user_id],
    queryFn: () => adminGetUserActions({ data: { userId: focus!.user_id, limit: 50 } }),
    enabled: enabled && !!focus?.user_id,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-actions-recent"] });
    qc.invalidateQueries({ queryKey: ["admin-user-actions"] });
  };

  const apply = useMutation({
    mutationFn: (v: { userId: string; action: Action; amount: number; reason: string }) =>
      adminApplyWalletAction({ data: v }),
    onSuccess: () => { toast.success("Applied"); invalidateAll(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const bulk = useMutation({
    mutationFn: (v: Parameters<typeof adminBulkWalletAction>[0]["data"]) =>
      adminBulkWalletAction({ data: v }),
    onSuccess: (res) => { toast.success(`Bulk: ${res.success}/${res.attempted} succeeded`); invalidateAll(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Bulk failed"),
  });

  const rows = users.data ?? [];
  const totalSelected = useMemo(() => rows.filter((r) => selected.has(r.user_id)).length, [rows, selected]);

  if (admin.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!admin.data?.admin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Admin · User Wallets" description="Restricted to admins." />
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">You do not have admin access.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin · User Wallets" description="Search users, manage credits, run bulk grants, view ledger." />

      {/* Search */}
      <Card className="glass rounded-3xl p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or user id…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
          <span className="text-xs text-muted-foreground">{rows.length} match{rows.length === 1 ? "" : "es"}</span>
        </div>
      </Card>

      {/* Bulk actions */}
      <BulkPanel
        plans={plans.data ?? []}
        selectedIds={Array.from(selected)}
        totalSelected={totalSelected}
        onRun={(v) => bulk.mutate(v)}
        loading={bulk.isPending}
      />

      {/* Users table */}
      <Card className="glass rounded-3xl p-3 shadow-soft">
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card/80 backdrop-blur">
              <tr className="text-left text-muted-foreground">
                <th className="p-2 w-8"></th>
                <th className="p-2">User</th>
                <th className="p-2">Plan</th>
                <th className="p-2 text-right">Balance</th>
                <th className="p-2 text-right">Purchased</th>
                <th className="p-2 text-right">Used</th>
                <th className="p-2 text-right">Refunded</th>
                <th className="p-2">Status</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} className="border-t border-border/40 hover:bg-card/40">
                  <td className="p-2">
                    <Checkbox
                      checked={selected.has(u.user_id)}
                      onCheckedChange={(v) => {
                        setSelected((s) => {
                          const n = new Set(s);
                          if (v) n.add(u.user_id); else n.delete(u.user_id);
                          return n;
                        });
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{u.display_name ?? "—"}</div>
                    <div className="text-muted-foreground">{u.email ?? u.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="p-2">{u.plan_id} · {u.subscription_status}</td>
                  <td className="p-2 text-right tabular-nums">
                    {u.unlimited_credits ? (
                      <span className="inline-flex items-center gap-1 text-primary"><InfinityIcon className="h-3 w-3" /> ∞</span>
                    ) : u.balance.toLocaleString()}
                  </td>
                  <td className="p-2 text-right tabular-nums">{u.lifetime_purchased.toLocaleString()}</td>
                  <td className="p-2 text-right tabular-nums">{u.lifetime_used.toLocaleString()}</td>
                  <td className="p-2 text-right tabular-nums">{u.lifetime_refunded.toLocaleString()}</td>
                  <td className="p-2">
                    {u.unlimited_credits && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] uppercase text-primary">Unlimited</span>}
                  </td>
                  <td className="p-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => setFocus(u)}>Manage</Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !users.isLoading && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent audit log */}
      <Card className="glass rounded-3xl p-5 shadow-soft space-y-2">
        <h4 className="font-semibold">Recent admin actions</h4>
        <div className="space-y-1 text-xs max-h-64 overflow-auto">
          {(recent.data ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-1.5">
              <span className="truncate">
                <span className="font-mono">{a.admin_id?.slice(0, 8)}</span> → <span className="font-mono">{a.user_id?.slice(0, 8) ?? "bulk"}</span>
                {" · "}<span className="font-medium">{a.action}</span>{" "}
                {a.amount ? `${a.amount}` : ""} {a.scope !== "single" ? `(${a.scope})` : ""}
              </span>
              <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
          {(recent.data ?? []).length === 0 && <p className="text-muted-foreground">No admin actions logged yet.</p>}
        </div>
      </Card>

      {/* Manage sheet */}
      {focus && (
        <ManageDialog
          user={focus}
          actions={userActions.data ?? []}
          onClose={() => setFocus(null)}
          onRequest={(a) => setPending(a)}
        />
      )}

      {/* Confirmation dialog for every action */}
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {pending?.action.replace("_", " ")}</AlertDialogTitle>
            <AlertDialogDescription>
              {focus && pending && describeAction(pending.action, pending.amount, focus)}
              <br />
              <span className="mt-2 block text-xs text-muted-foreground">Reason: {pending?.reason}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!focus || !pending) return;
                apply.mutate({ userId: focus.user_id, ...pending });
                setPending(null);
              }}
            >Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function describeAction(action: Action, amount: number, u: UserRow) {
  switch (action) {
    case "add": return `Add ${amount.toLocaleString()} credits to ${u.email ?? u.user_id}. New balance ≈ ${(u.balance + amount).toLocaleString()}.`;
    case "deduct": return `Deduct ${amount.toLocaleString()} credits from ${u.email ?? u.user_id}. New balance ≈ ${Math.max(0, u.balance - amount).toLocaleString()}.`;
    case "set": return `Set balance to ${amount.toLocaleString()} for ${u.email ?? u.user_id}.`;
    case "reset": return `Reset balance to 0 for ${u.email ?? u.user_id}.`;
    case "unlimited_on": return `Enable Unlimited Credits for ${u.email ?? u.user_id}. Generations will be logged but never charged.`;
    case "unlimited_off": return `Disable Unlimited Credits for ${u.email ?? u.user_id}.`;
    case "beta_bonus": return `Grant ${amount.toLocaleString()} promotional Beta Bonus credits to ${u.email ?? u.user_id}.`;
  }
}

function ManageDialog({ user, actions, onClose, onRequest }: {
  user: UserRow;
  actions: Awaited<ReturnType<typeof adminGetUserActions>>;
  onClose: () => void;
  onRequest: (v: { action: Action; amount: number; reason: string }) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const disabled = reason.trim().length < 3;
  const req = (action: Action, needAmount = true) => {
    if (needAmount && amount <= 0) { toast.error("Amount required"); return; }
    if (disabled) { toast.error("Reason required"); return; }
    onRequest({ action, amount: needAmount ? amount : 0, reason: reason.trim() });
  };
  return (
    <AlertDialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{user.display_name ?? user.email ?? user.user_id}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            {user.email} · plan {user.plan_id} · balance {user.unlimited_credits ? "∞" : user.balance.toLocaleString()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Amount</label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Reason (required)</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Support credit for failed run" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => req("add")} disabled={disabled}><Coins className="mr-1 h-3 w-3" />Add</Button>
            <Button size="sm" variant="destructive" onClick={() => req("deduct")} disabled={disabled}>Deduct</Button>
            <Button size="sm" variant="outline" onClick={() => req("set")} disabled={disabled}>Set exact</Button>
            <Button size="sm" variant="outline" onClick={() => req("reset", false)} disabled={disabled}>Reset to 0</Button>
            <Button size="sm" variant="outline" onClick={() => req("beta_bonus")} disabled={disabled}>
              <Sparkles className="mr-1 h-3 w-3" />Beta Bonus
            </Button>
            {user.unlimited_credits ? (
              <Button size="sm" variant="secondary" onClick={() => req("unlimited_off", false)} disabled={disabled}>Disable Unlimited</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => req("unlimited_on", false)} disabled={disabled}>
                <InfinityIcon className="mr-1 h-3 w-3" />Enable Unlimited
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">History</p>
            <div className="max-h-56 space-y-1 overflow-auto text-xs">
              {actions.map((a) => (
                <div key={a.id} className="flex justify-between rounded border border-border/50 bg-card/50 px-2 py-1">
                  <span>{a.action} · {a.amount || 0} · {a.reason}</span>
                  <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
              {actions.length === 0 && <p className="text-muted-foreground">No history.</p>}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BulkPanel({ plans, selectedIds, totalSelected, onRun, loading }: {
  plans: Awaited<ReturnType<typeof listPlans>>;
  selectedIds: string[];
  totalSelected: number;
  onRun: (v: Parameters<typeof adminBulkWalletAction>[0]["data"]) => void;
  loading: boolean;
}) {
  const [scope, setScope] = useState<"all" | "plan" | "selected">("selected");
  const [action, setAction] = useState<"add" | "deduct" | "beta_bonus">("add");
  const [amount, setAmount] = useState(50);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "free");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="glass rounded-3xl p-5 shadow-soft space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Bulk actions</h4>
        <span className="text-xs text-muted-foreground">{totalSelected} selected</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Scope</label>
          <select className="block h-9 rounded-md border border-input bg-background px-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="selected">Selected ({totalSelected})</option>
            <option value="plan">By plan</option>
            <option value="all">All users</option>
          </select>
        </div>
        {scope === "plan" && (
          <div>
            <label className="text-xs text-muted-foreground">Plan</label>
            <select className="block h-9 rounded-md border border-input bg-background px-2 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Action</label>
          <select className="block h-9 rounded-md border border-input bg-background px-2 text-sm" value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
            <option value="add">Add credits</option>
            <option value="beta_bonus">Beta bonus</option>
            <option value="deduct">Deduct credits</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Amount</label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))} className="w-28" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Reason</label>
          <Textarea rows={1} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. October launch bonus" />
        </div>
        <Button
          disabled={loading || reason.trim().length < 3 || (scope === "selected" && selectedIds.length === 0)}
          onClick={() => setConfirming(true)}
        >Run bulk</Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm bulk {action.replace("_", " ")}</AlertDialogTitle>
            <AlertDialogDescription>
              {scope === "selected" && `Apply to ${selectedIds.length} selected users.`}
              {scope === "plan" && `Apply to every user on plan "${planId}".`}
              {scope === "all" && `Apply to EVERY registered user. This cannot be undone.`}
              <br />Amount: {amount.toLocaleString()} · Reason: {reason}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirming(false);
              onRun({ scope, planId: scope === "plan" ? planId : undefined, userIds: scope === "selected" ? selectedIds : undefined, action, amount, reason: reason.trim() });
            }}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

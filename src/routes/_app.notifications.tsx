import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Bell } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";
import { formatDbError } from "@/lib/dbError";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — StorySpark AI" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const q = useQuery({
    queryKey: ["notifications", "page"],
    queryFn: () => list({ data: { limit: 100 } }),
    refetchInterval: 30000,
  });
  const items = q.data?.notifications ?? [];
  const readOne = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(formatDbError(e)),
  });
  const readAll = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); toast.success("All read"); },
    onError: (e) => toast.error(formatDbError(e)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Generation, publishing, and billing updates for your account." />
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending || items.every((n) => n.read_at)} className="rounded-xl">
          <Check className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </div>
      <Card className="glass overflow-hidden rounded-3xl shadow-soft">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-sm text-muted-foreground">
            <Bell className="h-6 w-6" />
            No notifications yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className={`px-5 py-4 ${n.read_at ? "opacity-60" : "bg-primary/[.03]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{n.title}</p>
                    {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{n.kind} · {new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.read_at && (
                    <Button size="sm" variant="ghost" onClick={() => readOne.mutate(n.id)} className="rounded-lg">Mark read</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
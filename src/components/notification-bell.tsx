import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";
import { useAuth } from "@/lib/auth";
import { formatDbError } from "@/lib/dbError";
import { toast } from "sonner";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => list({ data: { limit: 20 } }),
    enabled: !!user,
    refetchInterval: 30000,
  });
  const items = query.data?.notifications ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  const readOne = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast.error(formatDbError(e)),
  });
  const readAll = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked read");
    },
    onError: (e) => toast.error(formatDbError(e)),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative rounded-xl">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button size="sm" variant="ghost" onClick={() => readAll.mutate()} disabled={readAll.isPending} className="h-7 rounded-lg text-xs">
                <Check className="mr-1 h-3 w-3" /> Mark all read
              </Button>
            )}
            <Button asChild size="sm" variant="ghost" className="h-7 rounded-lg text-xs">
              <Link to="/notifications">View all</Link>
            </Button>
          </div>
        </div>
        <ul className="max-h-96 divide-y divide-border overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">You're all caught up.</li>
          ) : items.map((n) => (
            <li
              key={n.id}
              className={`px-4 py-3 text-sm ${n.read_at ? "opacity-60" : "bg-primary/[.03]"} cursor-pointer transition hover:bg-muted/40`}
              onClick={() => { if (!n.read_at) readOne.mutate(n.id); }}
            >
              <p className="font-medium leading-snug">{n.title}</p>
              {n.body ? <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p> : null}
              <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const NOTIFICATION_KINDS = [
  "generation_complete",
  "generation_failed",
  "publish_complete",
  "publish_failed",
  "credits_low",
  "subscription_renewed",
  "render_failed",
  "render_complete",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
};

const ListInput = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  unreadOnly: z.boolean().optional(),
}).optional();

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 50);
    if (data?.unreadOnly) q = q.is("read_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { notifications: (rows ?? []) as NotificationRow[] };
  });

export const countUnreadNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { count: count ?? 0 };
  });

const MarkInput = z.object({ id: z.string().uuid() });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MarkInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return { ok: true };
  });

const PushInput = z.object({
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string().min(1).max(200),
  body: z.string().max(1000).optional(),
  projectId: z.string().uuid().optional(),
});

// Self-push: the current user creates a notification for themselves.
// Server-triggered notifications (from pipeline or webhooks) call
// pushNotificationFor inside their own server module using supabaseAdmin.
export const pushSelfNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PushInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      kind: data.kind,
      title: data.title,
      body: data.body ?? null,
      project_id: data.projectId ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });
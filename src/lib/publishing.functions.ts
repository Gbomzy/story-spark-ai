import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PLATFORMS = ["youtube", "facebook", "instagram", "tiktok", "linkedin", "x"] as const;
export type Platform = (typeof PLATFORMS)[number];
const PlatformEnum = z.enum(PLATFORMS);

export type PublishConnection = {
  id: string;
  platform: Platform;
  status: "connected" | "disconnected" | "expired" | "error";
  account_name: string | null;
  account_id: string | null;
  scopes: string[] | null;
  connected_at: string | null;
  disconnected_at: string | null;
  expires_at: string | null;
  meta: unknown;
};

export type PublishHistoryRow = {
  id: string;
  project_id: string | null;
  platform: Platform;
  external_post_id: string | null;
  status: "queued" | "uploading" | "processing" | "published" | "failed" | "scheduled";
  title: string | null;
  description: string | null;
  tags: string[] | null;
  hashtags: string[] | null;
  thumbnail_url: string | null;
  video_url: string | null;
  visibility: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  created_at: string;
  meta: unknown;
};

export const listPublishConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("publish_connections")
      .select("*")
      .order("platform", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PublishConnection[];
  });

export const connectPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      platform: PlatformEnum,
      account_name: z.string().min(1).max(120),
      account_id: z.string().max(120).optional(),
      scopes: z.array(z.string()).optional(),
      expires_at: z.string().datetime().optional(),
      meta: z.record(z.string(), z.any()).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      platform: data.platform,
      status: "connected" as const,
      account_name: data.account_name,
      account_id: data.account_id ?? null,
      scopes: data.scopes ?? null,
      expires_at: data.expires_at ?? null,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      meta: (data.meta ?? {}) as never,
    };
    const { error } = await context.supabase
      .from("publish_connections")
      .upsert(row, { onConflict: "user_id,platform" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ platform: PlatformEnum }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("publish_connections")
      .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
      .eq("platform", data.platform);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPublishHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("publish_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PublishHistoryRow[];
  });

const PublishInput = z.object({
  platform: PlatformEnum,
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).max(50).optional(),
  hashtags: z.array(z.string()).max(50).optional(),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  scheduledAt: z.string().datetime().optional(),
});

export const publishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PublishInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: conn, error: connErr } = await context.supabase
      .from("publish_connections")
      .select("status,account_name")
      .eq("platform", data.platform)
      .maybeSingle();
    if (connErr) throw new Error(connErr.message);
    if (!conn || conn.status !== "connected") {
      throw new Error("Platform connection required.");
    }

    const scheduled = Boolean(data.scheduledAt);
    const now = new Date().toISOString();
    const insert = {
      user_id: context.userId,
      project_id: data.projectId ?? null,
      platform: data.platform,
      status: scheduled ? ("scheduled" as const) : ("uploading" as const),
      title: data.title,
      description: data.description ?? null,
      tags: data.tags ?? null,
      hashtags: data.hashtags ?? null,
      thumbnail_url: data.thumbnailUrl ?? null,
      video_url: data.videoUrl ?? null,
      visibility: data.visibility,
      scheduled_at: data.scheduledAt ?? null,
      published_at: null as string | null,
      external_post_id: null as string | null,
      error_message: null as string | null,
      meta: { account: conn.account_name ?? null, submitted_at: now } as never,
    };
    const { data: row, error } = await context.supabase
      .from("publish_history")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as PublishHistoryRow;
  });

export const updatePublishStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["queued", "uploading", "processing", "published", "failed", "scheduled"]),
      external_post_id: z.string().optional(),
      error_message: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch = {
      status: data.status,
      external_post_id: data.external_post_id ?? undefined,
      error_message: data.error_message ?? undefined,
      published_at: data.status === "published" ? new Date().toISOString() : undefined,
    };
    const { error } = await context.supabase.from("publish_history").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const retryPublish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("publish_history")
      .update({ status: "uploading", error_message: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
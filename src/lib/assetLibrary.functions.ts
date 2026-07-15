import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ASSET_KINDS = [
  "story",
  "character",
  "storyboard",
  "image",
  "voice",
  "music",
  "video",
  "movie",
  "thumbnail",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type AssetRow = {
  id: string;
  project_id: string;
  user_id: string;
  asset_type: string;
  title: string;
  description: string | null;
  status: string;
  provider: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
};

const SaveInput = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(ASSET_KINDS),
  title: z.string().min(1).max(200),
  url: z.string().optional(),
  description: z.string().optional(),
  provider: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Idempotent save: dedupe on (project, kind, url) if url is provided.
export const saveAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const meta: Record<string, unknown> = { ...(data.metadata ?? {}) };
    if (data.url) meta.url = data.url;
    if (data.url) {
      const { data: existing } = await supabase
        .from("project_assets")
        .select("id")
        .eq("project_id", data.projectId)
        .eq("user_id", userId)
        .eq("asset_type", data.kind)
        .contains("metadata", { url: data.url })
        .maybeSingle();
      if (existing) return { id: (existing as { id: string }).id, deduped: true };
    }
    // RLS blocks INSERT from user sessions on project_assets to protect
    // business-critical fields; use service_role for the write only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("project_assets")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        asset_type: data.kind,
        title: data.title,
        description: data.description ?? null,
        status: "ready",
        provider: data.provider ?? null,
        metadata: meta as never,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: (inserted as { id: string }).id, deduped: false };
  });

const ListInput = z.object({
  projectId: z.string().uuid().optional(),
  kind: z.enum(ASSET_KINDS).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const listAssetLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("project_assets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.kind) q = q.eq("asset_type", data.kind);
    const { data: rows, error } = await q;
    if (error) throw error;
    return { assets: (rows ?? []) as AssetRow[] };
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteAssetFromLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("project_assets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
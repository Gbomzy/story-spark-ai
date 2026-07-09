import { supabase } from "@/integrations/supabase/client";

// Types for tables not yet in generated types.ts — cast at call sites.
export type AssetType =
  | "story"
  | "characters"
  | "storyboard"
  | "voice_script"
  | "song"
  | "image_prompt"
  | "generated_image"
  | "voice_audio"
  | "music"
  | "subtitle"
  | "thumbnail"
  | "video";

export type AssetStatus =
  | "draft"
  | "pending"
  | "generating"
  | "completed"
  | "failed"
  | "published";

export interface ProjectAsset {
  id: string;
  project_id: string;
  user_id: string;
  asset_type: AssetType;
  title: string;
  description: string | null;
  status: AssetStatus;
  provider: string | null;
  active_version_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  user_id: string;
  version_number: number;
  name: string | null;
  content: string | null;
  payload: Record<string, unknown> | null;
  provider: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GenerationHistoryRow {
  id: string;
  user_id: string;
  project_id: string | null;
  asset_id: string | null;
  asset_type: string;
  provider: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  duration_ms: number | null;
  credits_used: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface QueueJob {
  id: string;
  user_id: string;
  project_id: string | null;
  asset_type: string;
  provider: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  estimated_seconds: number | null;
  retry_count: number;
  error_message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// Untyped table shortcut — types.ts hasn't regenerated for these new tables yet.
const t = (name: string) => (supabase as unknown as {
  from: (n: string) => ReturnType<typeof supabase.from>;
}).from(name);

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

// ============ Assets ============
export async function listAssets(opts?: {
  projectId?: string;
  type?: AssetType;
  status?: AssetStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ProjectAsset[]> {
  let q = t("project_assets").select("*").order("updated_at", { ascending: false });
  if (opts?.projectId) q = q.eq("project_id", opts.projectId);
  if (opts?.type) q = q.eq("asset_type", opts.type);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.search) q = q.ilike("title", `%${opts.search}%`);
  if (opts?.limit) q = q.range(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit - 1);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ProjectAsset[];
}

export async function createAsset(input: {
  project_id: string;
  asset_type: AssetType;
  title: string;
  description?: string;
  status?: AssetStatus;
  provider?: string;
  content?: string;
}): Promise<ProjectAsset> {
  const user_id = await uid();
  const { data, error } = await t("project_assets")
    .insert({
      project_id: input.project_id,
      user_id,
      asset_type: input.asset_type,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "draft",
      provider: input.provider ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  const asset = data as unknown as ProjectAsset;
  if (input.content !== undefined) {
    await createVersion({ asset_id: asset.id, content: input.content, provider: input.provider, setActive: true });
  }
  return asset;
}

export async function updateAsset(id: string, patch: Partial<ProjectAsset>): Promise<void> {
  const { error } = await t("project_assets").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await t("project_assets").delete().eq("id", id);
  if (error) throw error;
}

// ============ Versions ============
export async function listVersions(assetId: string): Promise<AssetVersion[]> {
  const { data, error } = await t("asset_versions")
    .select("*")
    .eq("asset_id", assetId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AssetVersion[];
}

export async function createVersion(input: {
  asset_id: string;
  content?: string;
  payload?: Record<string, unknown>;
  name?: string;
  provider?: string;
  setActive?: boolean;
}): Promise<AssetVersion> {
  const user_id = await uid();
  const existing = await listVersions(input.asset_id);
  const next = (existing[0]?.version_number ?? 0) + 1;
  const { data, error } = await t("asset_versions")
    .insert({
      asset_id: input.asset_id,
      user_id,
      version_number: next,
      name: input.name ?? `v${next}`,
      content: input.content ?? null,
      payload: input.payload ?? null,
      provider: input.provider ?? null,
      is_active: !!input.setActive,
    })
    .select()
    .single();
  if (error) throw error;
  const version = data as unknown as AssetVersion;
  if (input.setActive) await setActiveVersion(input.asset_id, version.id);
  return version;
}

export async function setActiveVersion(assetId: string, versionId: string): Promise<void> {
  await t("asset_versions").update({ is_active: false }).eq("asset_id", assetId);
  await t("asset_versions").update({ is_active: true }).eq("id", versionId);
  await t("project_assets").update({ active_version_id: versionId }).eq("id", assetId);
}

export async function renameVersion(id: string, name: string): Promise<void> {
  const { error } = await t("asset_versions").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await t("asset_versions").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateVersion(id: string): Promise<AssetVersion> {
  const { data, error } = await t("asset_versions").select("*").eq("id", id).single();
  if (error) throw error;
  const src = data as unknown as AssetVersion;
  return createVersion({
    asset_id: src.asset_id,
    content: src.content ?? undefined,
    payload: src.payload ?? undefined,
    name: `${src.name ?? "version"} (copy)`,
    provider: src.provider ?? undefined,
  });
}

// ============ History ============
export async function logGeneration(input: {
  project_id?: string;
  asset_id?: string;
  asset_type: string;
  provider?: string;
  status?: GenerationHistoryRow["status"];
  duration_ms?: number;
  credits_used?: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const user_id = await uid();
  await t("generation_history").insert({
    user_id,
    project_id: input.project_id ?? null,
    asset_id: input.asset_id ?? null,
    asset_type: input.asset_type,
    provider: input.provider ?? null,
    status: input.status ?? "completed",
    duration_ms: input.duration_ms ?? null,
    credits_used: input.credits_used ?? 0,
    error_message: input.error_message ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function listHistory(opts?: {
  projectId?: string;
  status?: string;
  provider?: string;
  search?: string;
  limit?: number;
}): Promise<GenerationHistoryRow[]> {
  let q = t("generation_history").select("*").order("created_at", { ascending: false });
  if (opts?.projectId) q = q.eq("project_id", opts.projectId);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.provider) q = q.eq("provider", opts.provider);
  if (opts?.search) q = q.ilike("asset_type", `%${opts.search}%`);
  q = q.limit(opts?.limit ?? 200);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as GenerationHistoryRow[];
}

// ============ Queue ============
export async function listQueue(opts?: { projectId?: string; status?: string }): Promise<QueueJob[]> {
  let q = t("generation_queue").select("*").order("created_at", { ascending: false });
  if (opts?.projectId) q = q.eq("project_id", opts.projectId);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as QueueJob[];
}

export async function enqueueJob(input: {
  project_id?: string;
  asset_type: string;
  provider?: string;
  estimated_seconds?: number;
  payload?: Record<string, unknown>;
}): Promise<QueueJob> {
  const user_id = await uid();
  const { data, error } = await t("generation_queue")
    .insert({
      user_id,
      project_id: input.project_id ?? null,
      asset_type: input.asset_type,
      provider: input.provider ?? null,
      status: "queued",
      progress: 0,
      estimated_seconds: input.estimated_seconds ?? null,
      payload: input.payload ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as QueueJob;
}

export async function updateJob(id: string, patch: Partial<QueueJob>): Promise<void> {
  const { error } = await t("generation_queue").update(patch).eq("id", id);
  if (error) throw error;
}

export async function cancelJob(id: string): Promise<void> {
  await updateJob(id, { status: "cancelled", completed_at: new Date().toISOString() });
}

export async function retryJob(id: string): Promise<void> {
  const { data } = await t("generation_queue").select("retry_count").eq("id", id).single();
  const retry = ((data as { retry_count?: number } | null)?.retry_count ?? 0) + 1;
  await updateJob(id, { status: "queued", progress: 0, error_message: null, retry_count: retry });
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await t("generation_queue").delete().eq("id", id);
  if (error) throw error;
}

// ============ Project completion ============
export const PROJECT_STAGES: { key: AssetType; label: string }[] = [
  { key: "story", label: "Story" },
  { key: "characters", label: "Characters" },
  { key: "storyboard", label: "Storyboard" },
  { key: "voice_script", label: "Voice Script" },
  { key: "song", label: "Song" },
  { key: "image_prompt", label: "Image Prompts" },
  { key: "generated_image", label: "Images" },
  { key: "voice_audio", label: "Narration" },
  { key: "music", label: "Music" },
  { key: "thumbnail", label: "Thumbnail" },
  { key: "video", label: "Video" },
];

export function computeCompletion(project: Record<string, unknown> | null | undefined): {
  percent: number;
  done: number;
  total: number;
  breakdown: { label: string; done: boolean }[];
} {
  if (!project) return { percent: 0, done: 0, total: PROJECT_STAGES.length, breakdown: [] };
  const map: Record<string, string | undefined> = {
    story: "story",
    characters: "characters",
    storyboard: "storyboard",
    voice_script: "voice",
    song: "songs",
    image_prompt: "images",
    generated_image: "generated_images",
    voice_audio: "voice_audio",
    music: "background_music",
    thumbnail: "thumbnail",
    video: "video_file",
  };
  const breakdown = PROJECT_STAGES.map((s) => {
    const field = map[s.key];
    const val = field ? (project as Record<string, unknown>)[field] : undefined;
    const done = val != null && (typeof val === "string" ? val.trim().length > 0 : true);
    return { label: s.label, done };
  });
  const done = breakdown.filter((b) => b.done).length;
  return { percent: Math.round((done / breakdown.length) * 100), done, total: breakdown.length, breakdown };
}
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export const PROJECT_CONTENT_FIELDS = [
  "story",
  "characters",
  "storyboard",
  "voice",
  "songs",
  "images",
  "seo",
] as const;
export type ProjectContentField = (typeof PROJECT_CONTENT_FIELDS)[number];

export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProject(input: Omit<ProjectInsert, "user_id">) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, user_id: u.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, patch: ProjectUpdate) {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string) {
  // Soft delete by default
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function hardDeleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function restoreProject(id: string) {
  await supabase.from("projects").update({ deleted_at: null }).eq("id", id);
}

export async function listTrash() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function toggleFavorite(id: string, value: boolean) {
  await supabase.from("projects").update({ is_favorite: value }).eq("id", id);
}

export async function togglePin(id: string, value: boolean) {
  await supabase.from("projects").update({ is_pinned: value }).eq("id", id);
}

export async function toggleArchive(id: string, value: boolean) {
  await supabase
    .from("projects")
    .update({ is_archived: value, archived_at: value ? new Date().toISOString() : null })
    .eq("id", id);
}

export async function updateTags(id: string, tags: string[]) {
  await supabase.from("projects").update({ tags }).eq("id", id);
}

export async function updateCategory(id: string, category: string | null) {
  await supabase.from("projects").update({ category }).eq("id", id);
}

export async function duplicateProject(id: string) {
  const src = await getProject(id);
  if (!src) throw new Error("Project not found");
  const { id: _id, created_at: _c, updated_at: _u, user_id: _uid, ...rest } = src;
  return createProject({ ...rest, name: `${src.name} (copy)` });
}

export async function touchOpened(id: string) {
  await supabase
    .from("projects")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", id);
}
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
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
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
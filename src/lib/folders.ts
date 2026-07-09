import { supabase } from "@/integrations/supabase/client";

const t = (n: string) => (supabase as unknown as { from: (n: string) => ReturnType<typeof supabase.from> }).from(n);

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function listFolders(): Promise<Folder[]> {
  const { data, error } = await t("folders").select("*").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []) as unknown as Folder[];
}

export async function createFolder(name: string, color?: string): Promise<Folder> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await t("folders").insert({ user_id: u.user.id, name, color: color ?? null }).select().single();
  if (error) throw error;
  return data as unknown as Folder;
}

export async function renameFolder(id: string, name: string) {
  const { error } = await t("folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string) {
  const { error } = await t("folders").delete().eq("id", id);
  if (error) throw error;
}

export async function moveProjectToFolder(projectId: string, folderId: string | null) {
  const { error } = await supabase.from("projects").update({ folder_id: folderId } as never).eq("id", projectId);
  if (error) throw error;
}

export async function bulkMoveToFolder(ids: string[], folderId: string | null) {
  const { error } = await supabase.from("projects").update({ folder_id: folderId } as never).in("id", ids);
  if (error) throw error;
}
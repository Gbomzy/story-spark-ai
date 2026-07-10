import Fuse from "fuse.js";
import { supabase } from "@/integrations/supabase/client";

export type SearchGroup = "projects" | "assets" | "history" | "tags";

export interface SearchHit {
  group: SearchGroup;
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
}

export interface SearchResults {
  projects: SearchHit[];
  assets: SearchHit[];
  history: SearchHit[];
  tags: SearchHit[];
}

const t = (n: string) => (supabase as unknown as { from: (n: string) => ReturnType<typeof supabase.from> }).from(n);

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  const empty: SearchResults = { projects: [], assets: [], history: [], tags: [] };
  if (!q) return empty;

  const [{ data: projects }, { data: assets }, { data: history }] = await Promise.all([
    supabase.from("projects")
      .select("id,name,story,characters,storyboard,voice,songs,images,seo,tags")
      .is("deleted_at", null)
      .limit(200),
    t("project_assets").select("id,title,description,asset_type,project_id").limit(200),
    t("generation_history").select("id,asset_type,provider,status,created_at").limit(200),
  ]);

  const projFuse = new Fuse(projects ?? [], {
    keys: ["name","story","characters","storyboard","voice","songs","images","seo","tags"],
    threshold: 0.4, ignoreLocation: true,
  });
  const assetFuse = new Fuse((assets as unknown as Record<string,string>[]) ?? [], {
    keys: ["title","description","asset_type"], threshold: 0.4,
  });
  const histFuse = new Fuse((history as unknown as Record<string,string>[]) ?? [], {
    keys: ["asset_type","provider","status"], threshold: 0.35,
  });

  const tagSet = new Map<string, number>();
  for (const p of (projects ?? [])) {
    const tags = (p as { tags?: string[] }).tags ?? [];
    for (const tag of tags) if (tag.toLowerCase().includes(q.toLowerCase())) tagSet.set(tag, (tagSet.get(tag) ?? 0) + 1);
  }

  return {
    projects: projFuse.search(q).slice(0, 20).map((r) => ({
      group: "projects", id: r.item.id, title: r.item.name || "Untitled",
      subtitle: (r.item.tags ?? []).slice(0, 3).join(", "),
      href: `/projects/${r.item.id}`,
    })),
    assets: assetFuse.search(q).slice(0, 20).map((r) => ({
      group: "assets", id: r.item.id, title: r.item.title, subtitle: r.item.asset_type,
      href: r.item.project_id ? `/projects/${r.item.project_id}` : "/assets",
    })),
    history: histFuse.search(q).slice(0, 20).map((r) => ({
      group: "history", id: r.item.id, title: r.item.asset_type, subtitle: `${r.item.provider ?? ""} · ${r.item.status}`,
      href: "/history",
    })),
    tags: Array.from(tagSet.entries()).slice(0, 20).map(([tag, count]) => ({
      group: "tags", id: tag, title: `#${tag}`, subtitle: `${count} project${count === 1 ? "" : "s"}`,
      href: `/projects?tag=${encodeURIComponent(tag)}`,
    })),
  };
}
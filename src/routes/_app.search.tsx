import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { globalSearch } from "@/lib/globalSearch";
import { FolderKanban, Boxes, History as HistoryIcon, Tag, Search as SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/skeletons";

export const Route = createFileRoute("/_app/search")({
  head: () => ({ meta: [{ title: "Search — StorySpark AI" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["global-search", q],
    queryFn: () => globalSearch(q),
    enabled: q.length > 0,
  });

  const groups = [
    { key: "projects" as const, label: "Projects", icon: FolderKanban },
    { key: "assets"   as const, label: "Assets",   icon: Boxes },
    { key: "history"  as const, label: "History",  icon: HistoryIcon },
    { key: "tags"     as const, label: "Tags",     icon: Tag },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description="Search across projects, story, characters, storyboards, voice, songs, image prompts, SEO, assets, history and tags." />
      <Card className="glass rounded-3xl p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything…" className="rounded-xl border-0 bg-transparent shadow-none focus-visible:ring-0" />
        </div>
      </Card>

      {!q && <EmptyState icon={<SearchIcon className="h-5 w-5" />} title="Start typing" description="Global fuzzy search across your entire workspace." />}

      {q && data && (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => {
            const Icon = g.icon;
            const hits = data[g.key];
            return (
              <Card key={g.key} className="glass rounded-3xl p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" /> {g.label}</div>
                  <span className="text-xs text-muted-foreground">{hits.length}</span>
                </div>
                {hits.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{isFetching ? "Searching…" : "No matches."}</p>
                ) : (
                  <ul className="space-y-1">
                    {hits.map((h) => (
                      <li key={`${h.group}-${h.id}`}>
                        {h.href ? (
                          <Link to={h.href} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm transition hover:bg-primary/5">
                            <span className="truncate font-medium">{h.title}</span>
                            {h.subtitle && <span className="ml-3 truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                          </Link>
                        ) : (
                          <div className="px-3 py-2 text-sm"><span className="font-medium">{h.title}</span></div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
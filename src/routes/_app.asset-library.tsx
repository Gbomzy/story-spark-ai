import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Boxes, Copy, Trash2, ExternalLink } from "lucide-react";
import {
  ASSET_KINDS,
  deleteAssetFromLibrary,
  listAssetLibrary,
  type AssetKind,
} from "@/lib/assetLibrary.functions";
import { formatDbError } from "@/lib/dbError";

export const Route = createFileRoute("/_app/asset-library")({
  head: () => ({ meta: [{ title: "Asset Library — StorySpark AI" }] }),
  component: AssetLibraryPage,
});

function AssetLibraryPage() {
  const [kind, setKind] = useState<AssetKind | "all">("all");
  const qc = useQueryClient();
  const list = useServerFn(listAssetLibrary);
  const del = useServerFn(deleteAssetFromLibrary);
  const query = useQuery({
    queryKey: ["asset-library", kind],
    queryFn: () => list({ data: kind === "all" ? {} : { kind } }),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removed from library"); qc.invalidateQueries({ queryKey: ["asset-library"] }); },
    onError: (e) => toast.error(formatDbError(e, "Delete failed")),
  });
  const assets = query.data?.assets ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Asset Library" description="Every generated story, character, image, audio and video you can reuse without regenerating." />

      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" active={kind === "all"} onClick={() => setKind("all")} />
        {ASSET_KINDS.map((k) => (
          <FilterChip key={k} label={k} active={kind === k} onClick={() => setKind(k)} />
        ))}
      </div>

      {assets.length === 0 ? (
        <Card className="glass flex flex-col items-center gap-2 rounded-3xl p-10 text-sm text-muted-foreground shadow-soft">
          <Boxes className="h-6 w-6" />
          Nothing here yet. Generated assets appear here automatically.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => {
            const meta = (a.metadata ?? {}) as { url?: string } | Record<string, unknown>;
            const url = typeof meta === "object" && meta && "url" in meta ? String((meta as { url?: unknown }).url ?? "") || undefined : undefined;
            return (
              <Card key={a.id} className="glass rounded-3xl p-4 shadow-soft">
                <div className="mb-2 flex items-center justify-between">
                  <Badge variant="secondary" className="rounded-full text-[10px] uppercase">{a.asset_type}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
                <p className="line-clamp-2 text-sm font-semibold">{a.title}</p>
                {a.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {url ? (
                    <>
                      <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs" onClick={() => { navigator.clipboard.writeText(url); toast.success("URL copied"); }}>
                        <Copy className="mr-1 h-3 w-3" /> Copy URL
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 rounded-lg text-xs">
                        <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" /> Open</a>
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs text-destructive hover:bg-destructive/10" onClick={() => delMut.mutate(a.id)}>
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${active ? "gradient-primary border-transparent text-white shadow-glow" : "border-border bg-card/60 text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );
}
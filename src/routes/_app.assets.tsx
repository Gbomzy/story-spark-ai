import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAssets, deleteAsset, updateAsset, type AssetStatus, type AssetType } from "@/lib/assets";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Boxes, Trash2, Pencil, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assets")({
  head: () => ({ meta: [{ title: "Assets — StorySpark AI" }] }),
  component: AssetsPage,
});

const STATUSES: (AssetStatus | "all")[] = ["all", "draft", "pending", "generating", "completed", "failed", "published"];
const TYPES: (AssetType | "all")[] = ["all", "story", "characters", "storyboard", "voice_script", "song", "image_prompt", "generated_image", "voice_audio", "music", "subtitle", "thumbnail", "video"];

function AssetsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["assets", { search, status, type }],
    queryFn: () => listAssets({
      search: search || undefined,
      status: status === "all" ? undefined : (status as AssetStatus),
      type: type === "all" ? undefined : (type as AssetType),
    }),
  });
  const del = useMutation({ mutationFn: deleteAsset, onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["assets"] }); } });
  const rename = useMutation({
    mutationFn: (v: { id: string; title: string }) => updateAsset(v.id, { title: v.title }),
    onSuccess: () => { toast.success("Renamed"); qc.invalidateQueries({ queryKey: ["assets"] }); },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-glow">
          <Boxes className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">All assets</h1>
          <p className="text-sm text-muted-foreground">Browse every generated item across your projects.</p>
        </div>
      </div>

      <Card className="glass rounded-2xl p-4 space-y-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title…" className="max-w-md rounded-xl" />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={status === s ? "default" : "ghost"} className="rounded-lg capitalize" onClick={() => setStatus(s)}>{s}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {TYPES.map((tp) => (
            <Button key={tp} size="sm" variant={type === tp ? "default" : "ghost"} className="rounded-lg text-xs capitalize" onClick={() => setType(tp)}>{tp.replaceAll("_", " ")}</Button>
          ))}
        </div>
      </Card>

      <Card className="glass rounded-2xl">
        {isLoading ? (
          <div className="grid place-items-center p-12 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No assets yet. Generate content in the studios and it will show up here.</div>
        ) : (
          <div className="divide-y divide-border">
            {data.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <span className="font-medium">{a.title}</span>
                <Badge variant="secondary" className="rounded-full text-[10px] uppercase">{a.asset_type.replaceAll("_", " ")}</Badge>
                <Badge variant="outline" className="rounded-full text-[10px] uppercase">{a.status}</Badge>
                {a.provider && <Badge variant="outline" className="rounded-full text-[10px]">{a.provider}</Badge>}
                <span className="text-muted-foreground">{new Date(a.updated_at).toLocaleDateString()}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/projects/$id" params={{ id: a.project_id }}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const next = prompt("Rename asset", a.title);
                    if (next && next !== a.title) rename.mutate({ id: a.id, title: next });
                  }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete asset?")) del.mutate(a.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
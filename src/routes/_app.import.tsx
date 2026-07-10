import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, FileUp } from "lucide-react";
import { parseImport, type ImportedProject } from "@/lib/importEngine";
import { createProject } from "@/lib/projects";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/import")({
  head: () => ({ meta: [{ title: "Import — StorySpark AI" }] }),
  component: ImportPage,
});

function ImportPage() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<ImportedProject | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const parse = useMutation({
    mutationFn: async (f: File) => parseImport(f),
    onSuccess: (p) => { setPreview(p); toast.success(`Parsed "${p.name}"`); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Parse failed"),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Nothing to import");
      return createProject({
        name: preview.name,
        story: preview.story ?? null,
        characters: preview.characters ?? null,
        storyboard: preview.storyboard ?? null,
        voice: preview.voice ?? null,
        songs: preview.songs ?? null,
        images: preview.images ?? null,
        seo: preview.seo ?? null,
      } as never);
    },
    onSuccess: (p) => { toast.success("Project created"); navigate({ to: "/projects/$id", params: { id: p.id } }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Import" description="Restore a project from TXT, Markdown, DOCX, JSON, or a full StorySpark ZIP backup." />
      <Card className="glass rounded-3xl p-8 shadow-soft">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border p-10 text-center transition hover:border-primary/50 hover:bg-primary/5">
          <div className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-white shadow-glow"><Upload className="h-6 w-6" /></div>
          <div>
            <p className="font-semibold">Drop a file or click to browse</p>
            <p className="text-xs text-muted-foreground">TXT · MD · DOCX · JSON · ZIP</p>
          </div>
          <input type="file" className="hidden" accept=".txt,.md,.markdown,.docx,.json,.zip" onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setFile(f); parse.mutate(f);
          }} />
        </label>
        {file && <p className="mt-3 text-center text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
      </Card>

      {preview && (
        <Card className="glass rounded-3xl p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Preview: {preview.name}</h3>
            <Button className="rounded-xl gradient-primary text-white shadow-glow" disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />} Create project
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["story","characters","storyboard","voice","songs","images","seo"] as const).map((k) => (
              <div key={k} className="rounded-2xl border border-border bg-card/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-xs">{preview[k] || "—"}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
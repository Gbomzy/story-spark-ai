import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ImageIcon, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { listProjects, updateProject } from "@/lib/projects";
import { generateMediaPack } from "@/lib/qwen.functions";
import { generateQwenImage } from "@/lib/qwenImage.functions";

export const Route = createFileRoute("/_app/image-prompts")({
  head: () => ({ meta: [{ title: "Image Prompts — StorySpark AI" }] }),
  component: ImagePromptsPage,
});

type Prompt = { id: string; prompt: string };

function parsePrompts(text: string): Prompt[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed);
      const arr = Array.isArray(j) ? j : Array.isArray(j?.prompts) ? j.prompts : [];
      return arr.slice(0, 30).map((it: unknown, i: number) => {
        const o = (it ?? {}) as Record<string, unknown>;
        const p = String(o.prompt ?? o.description ?? o.text ?? it ?? "").trim();
        return { id: String(o.id ?? `prompt-${i + 1}`), prompt: p };
      }).filter((p) => p.prompt);
    } catch { /* fallthrough */ }
  }
  return trimmed.split(/\n\s*\n/).slice(0, 30).map((p, i) => ({ id: `prompt-${i + 1}`, prompt: p.trim() })).filter((p) => p.prompt);
}

function ImagePromptsPage() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;
  const genPrompts = useServerFn(generateMediaPack);
  const genImage = useServerFn(generateQwenImage);

  const regenMut = useMutation({
    mutationFn: async () => {
      if (!project?.story) throw new Error("Generate a story first");
      const brief = `Project: ${project.name}\nTopic: ${project.topic ?? ""}`;
      const r = await genPrompts({ data: { prompt: brief, story: project.story, ageGroup: project.age_group ?? undefined, language: project.language ?? undefined, style: project.style ?? undefined } });
      await updateProject(project.id, { images: r.images });
    },
    onSuccess: () => { toast.success("Prompts regenerated"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Regeneration failed"),
  });

  const imageMut = useMutation({
    mutationFn: async (p: Prompt) => {
      if (!project) return null;
      const r = await genImage({ data: { prompt: p.prompt.slice(0, 800), projectId: project.id, sceneId: p.id, aspect: "16:9" } });
      return r.url;
    },
    onSuccess: () => { toast.success("Image ready"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Image generation failed"),
  });

  const prompts = parsePrompts(project?.images ?? "");
  const generated = (project?.generated_images as Array<{ id: string; url: string }> | null) ?? [];
  const byId = new Map(generated.map((g) => [g.id, g.url]));

  if (isLoading) return <div className="grid place-items-center py-24 text-sm text-muted-foreground"><Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Image Prompts" description="Reusable prompts and generated stills powered by Qwen Image 2.0." />

      {!project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first to build image prompts.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow"><Link to="/story-generator">Start a story</Link></Button>
        </Card>
      ) : (
        <>
          <Card className="glass rounded-3xl p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Project</p>
                <h3 className="text-lg font-bold">{project.name}</h3>
                <p className="text-xs text-muted-foreground">{prompts.length} prompt{prompts.length === 1 ? "" : "s"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Qwen Image · Connected</Badge>
                <Button onClick={() => regenMut.mutate()} disabled={regenMut.isPending} variant="outline" className="rounded-xl">
                  {regenMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Regenerating…</> : <><RefreshCw className="mr-1.5 h-4 w-4" /> Regenerate prompts</>}
                </Button>
              </div>
            </div>
          </Card>

          {prompts.length === 0 ? (
            <Card className="glass rounded-3xl p-10 text-center shadow-soft">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No prompts yet. Click Regenerate above.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {prompts.map((p, i) => {
                const url = byId.get(p.id);
                return (
                  <Card key={p.id} className="glass overflow-hidden rounded-2xl p-0 shadow-soft">
                    <div className="relative aspect-video w-full bg-muted">
                      {url ? (
                        <img src={url} alt={`Prompt ${i + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-muted-foreground"><ImageIcon className="h-8 w-8 opacity-40" /></div>
                      )}
                      <Badge className="absolute left-2 top-2 rounded-full bg-background/80 text-[10px] uppercase tracking-wider">#{i + 1}</Badge>
                    </div>
                    <div className="space-y-3 p-4">
                      <p className="line-clamp-5 text-xs text-muted-foreground">{p.prompt}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded-lg" disabled={imageMut.isPending} onClick={() => imageMut.mutate(p)}>
                          {imageMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                          {url ? "Regenerate" : "Generate image"}
                        </Button>
                        {url && (
                          <Button asChild size="sm" variant="ghost" className="rounded-lg">
                            <a href={url} download><Download className="mr-1.5 h-3.5 w-3.5" /> Download</a>
                          </Button>
                        )}
                        <span className="ml-auto self-center text-[10px] text-muted-foreground">~1 credit</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
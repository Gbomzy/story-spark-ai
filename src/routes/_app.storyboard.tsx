import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Film, RefreshCw, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { listProjects, updateProject } from "@/lib/projects";
import { generateStoryboard } from "@/lib/qwen.functions";
import { generateQwenImage } from "@/lib/qwenImage.functions";

export const Route = createFileRoute("/_app/storyboard")({
  head: () => ({ meta: [{ title: "Storyboard — StorySpark AI" }] }),
  component: StoryboardPage,
});

type Scene = { id: string; title: string; description: string; duration?: string };

function parseScenes(text: string): Scene[] {
  if (!text) return [];
  // Split on numbered scene headers "Scene 1", "1." or blank-line blocks
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.slice(0, 20).map((block, i) => {
    const firstLine = block.split("\n")[0].trim();
    const rest = block.split("\n").slice(1).join("\n").trim();
    return {
      id: `scene-${i + 1}`,
      title: firstLine.replace(/^#+\s*/, "").slice(0, 120) || `Scene ${i + 1}`,
      description: rest || firstLine,
      duration: undefined,
    };
  });
}

function StoryboardPage() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;
  const regen = useServerFn(generateStoryboard);
  const genImage = useServerFn(generateQwenImage);

  const regenMut = useMutation({
    mutationFn: async () => {
      if (!project) return;
      const brief = `Project: ${project.name}\nTopic: ${project.topic ?? ""}\nStyle: ${project.style ?? ""}`;
      const r = await regen({ data: { prompt: brief, story: project.story ?? undefined, ageGroup: project.age_group ?? undefined, language: project.language ?? undefined, style: project.style ?? undefined } });
      await updateProject(project.id, { storyboard: r.storyboard });
    },
    onSuccess: () => { toast.success("Storyboard regenerated"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Regeneration failed"),
  });

  const sceneImageMut = useMutation({
    mutationFn: async (scene: Scene) => {
      if (!project) return null;
      const r = await genImage({ data: { prompt: `${scene.title}. ${scene.description}`.slice(0, 800), projectId: project.id, sceneId: scene.id, aspect: "16:9" } });
      return r.url;
    },
    onSuccess: (url) => { if (url) toast.success("Scene image ready"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Image generation failed"),
  });

  const scenes = parseScenes(project?.storyboard ?? "");
  const generatedImages = (project?.generated_images as Array<{ id: string; url: string }> | null) ?? [];
  const imageBySceneId = new Map(generatedImages.map((g) => [g.id, g.url]));

  if (isLoading) return <div className="grid place-items-center py-24 text-sm text-muted-foreground"><Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Storyboard" description="Scene-by-scene visual planning powered by Qwen." />

      {!project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first to build a storyboard.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow"><Link to="/story-generator">Start a story</Link></Button>
        </Card>
      ) : (
        <>
          <Card className="glass rounded-3xl p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Project</p>
                <h3 className="text-lg font-bold">{project.name}</h3>
                <p className="text-xs text-muted-foreground">{scenes.length} scene{scenes.length === 1 ? "" : "s"}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => regenMut.mutate()} disabled={regenMut.isPending} variant="outline" className="rounded-xl">
                  {regenMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Regenerating…</> : <><RefreshCw className="mr-1.5 h-4 w-4" /> Regenerate storyboard</>}
                </Button>
                <Button asChild className="rounded-xl gradient-primary text-white shadow-glow">
                  <Link to="/video-studio">Open in Video Studio</Link>
                </Button>
              </div>
            </div>
          </Card>

          {scenes.length === 0 ? (
            <Card className="glass rounded-3xl p-10 text-center shadow-soft">
              <Film className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No storyboard yet. Click Regenerate above.</p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {scenes.map((s, i) => {
                const url = imageBySceneId.get(s.id);
                return (
                  <Card key={s.id} className="glass overflow-hidden rounded-2xl p-0 shadow-soft">
                    <div className="relative aspect-video w-full bg-muted">
                      {url ? (
                        <img src={url} alt={s.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center text-muted-foreground"><ImageIcon className="h-8 w-8 opacity-40" /></div>
                      )}
                      <Badge className="absolute left-2 top-2 rounded-full bg-background/80 text-[10px] uppercase tracking-wider">Scene {i + 1}</Badge>
                    </div>
                    <div className="space-y-2 p-4">
                      <p className="text-sm font-semibold">{s.title}</p>
                      <p className="line-clamp-4 text-xs text-muted-foreground">{s.description}</p>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="rounded-lg" disabled={sceneImageMut.isPending} onClick={() => sceneImageMut.mutate(s)}>
                          {sceneImageMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                          {url ? "Regenerate image" : "Generate image"}
                        </Button>
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
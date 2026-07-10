import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Music, RefreshCw, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { listProjects, updateProject } from "@/lib/projects";
import { generateMediaPack } from "@/lib/qwen.functions";

export const Route = createFileRoute("/_app/songs")({
  head: () => ({ meta: [{ title: "Songs — StorySpark AI" }] }),
  component: SongsPage,
});

function SongsPage() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;
  const gen = useServerFn(generateMediaPack);

  const mut = useMutation({
    mutationFn: async () => {
      if (!project?.story) throw new Error("Generate a story first");
      const brief = `Project: ${project.name}\nTopic: ${project.topic ?? ""}`;
      const r = await gen({ data: { prompt: brief, story: project.story, ageGroup: project.age_group ?? undefined, language: project.language ?? undefined, style: project.style ?? undefined } });
      await updateProject(project.id, { songs: r.songs });
    },
    onSuccess: () => { toast.success("Song regenerated"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Regeneration failed"),
  });

  const lyrics = project?.songs ?? "";
  function download() {
    if (!project) return;
    const blob = new Blob([lyrics], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${project.name.replace(/\s+/g, "-").toLowerCase()}-song.txt`; a.click();
  }

  if (isLoading) return <div className="grid place-items-center py-24 text-sm text-muted-foreground"><Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader title="Songs" description="Original jingles, lullabies and theme songs written by Qwen." />

      {!project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first to compose a song.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow"><Link to="/story-generator">Start a story</Link></Button>
        </Card>
      ) : (
        <>
          <Card className="glass rounded-3xl p-6 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Project</p>
                <h3 className="text-lg font-bold">{project.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Theme: {project.topic ?? "—"} · Mood: {project.style ?? "—"}</p>
              </div>
              <Badge className="rounded-full bg-muted text-muted-foreground">Music synthesis unavailable</Badge>
            </div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Lyrics</p>
            <Textarea readOnly value={lyrics} placeholder="No song yet — click Regenerate to compose lyrics." className="min-h-[280px] rounded-2xl bg-card/60 leading-relaxed" />

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="rounded-xl gradient-primary text-white shadow-glow">
                {mut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Composing…</> : <><RefreshCw className="mr-1.5 h-4 w-4" /> Regenerate</>}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(lyrics); toast.success("Copied"); }} disabled={!lyrics}>
                <Copy className="mr-1.5 h-4 w-4" /> Copy
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={download} disabled={!lyrics}>
                <Download className="mr-1.5 h-4 w-4" /> Download TXT
              </Button>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <Music className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Music generation is currently unavailable under the configured Qwen Cloud capabilities. Lyrics remain available for export and future re-scoring.</span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
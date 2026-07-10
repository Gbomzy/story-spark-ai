import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, RefreshCw, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { listProjects, updateProject } from "@/lib/projects";
import { generateMediaPack } from "@/lib/qwen.functions";

export const Route = createFileRoute("/_app/seo-studio")({
  head: () => ({ meta: [{ title: "SEO Studio — StorySpark AI" }] }),
  component: SeoStudioPage,
});

function parseSeo(text: string) {
  const out: { title?: string; description?: string; keywords?: string[]; hashtags?: string[] } = {};
  if (!text) return out;
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      out.title = typeof j.title === "string" ? j.title : undefined;
      out.description = typeof j.description === "string" ? j.description : undefined;
      out.keywords = Array.isArray(j.keywords) ? j.keywords.map(String) : undefined;
      out.hashtags = Array.isArray(j.hashtags) ? j.hashtags.map(String) : undefined;
      return out;
    } catch {
      /* fallthrough */
    }
  }
  const titleM = text.match(/title[:\s-]+(.+)/i);
  const descM = text.match(/description[:\s-]+([\s\S]+?)(?:\n\n|\nkeywords|\nhashtags|$)/i);
  const kwM = text.match(/keywords?[:\s-]+(.+)/i);
  const tagsM = text.match(/hashtags?[:\s-]+(.+)/i);
  if (titleM) out.title = titleM[1].trim();
  if (descM) out.description = descM[1].trim();
  if (kwM) out.keywords = kwM[1].split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (tagsM) out.hashtags = tagsM[1].split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return out;
}

function SeoStudioPage() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;
  const gen = useServerFn(generateMediaPack);

  const mut = useMutation({
    mutationFn: async () => {
      if (!project || !project.story) throw new Error("Generate a story first");
      const brief = `Project: ${project.name}\nTopic: ${project.topic ?? ""}`;
      const r = await gen({ data: { prompt: brief, story: project.story, ageGroup: project.age_group ?? undefined, language: project.language ?? undefined, style: project.style ?? undefined } });
      await updateProject(project.id, { seo: r.seo });
    },
    onSuccess: () => { toast.success("SEO regenerated"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Regeneration failed"),
  });

  const raw = project?.seo ?? "";
  const seo = parseSeo(raw);

  function copy(v: string) { navigator.clipboard.writeText(v); toast.success("Copied"); }
  function exportJson() {
    if (!project) return;
    const blob = new Blob([JSON.stringify({ ...seo, raw }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${project.name.replace(/\s+/g, "-").toLowerCase()}-seo.json`; a.click();
  }

  if (isLoading) return <div className="grid place-items-center py-24 text-sm text-muted-foreground"><Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader title="SEO Studio" description="Titles, descriptions, keywords and hashtags optimized by Qwen." />

      {!project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first to generate SEO metadata.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow"><Link to="/story-generator">Start a story</Link></Button>
        </Card>
      ) : (
        <>
          <Card className="glass rounded-3xl p-6 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Project</p>
                <h3 className="text-lg font-bold">{project.name}</h3>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="rounded-xl gradient-primary text-white shadow-glow">
                  {mut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating…</> : <><RefreshCw className="mr-1.5 h-4 w-4" /> Regenerate</>}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={exportJson} disabled={!raw}>
                  <Download className="mr-1.5 h-4 w-4" /> Export JSON
                </Button>
              </div>
            </div>

            {!raw ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                <Search className="mb-2 h-8 w-8 opacity-40" />
                No SEO metadata yet. Click Regenerate.
              </div>
            ) : (
              <div className="space-y-4">
                <Section label="Title" value={seo.title ?? ""} onCopy={copy} />
                <Section label="Description" value={seo.description ?? ""} onCopy={copy} multiline />
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(seo.keywords ?? []).map((k) => <Badge key={k} variant="secondary" className="rounded-full">{k}</Badge>)}
                    {(seo.keywords ?? []).length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(seo.hashtags ?? []).map((h) => <Badge key={h} className="rounded-full bg-primary/15 text-primary">{h.startsWith("#") ? h : `#${h}`}</Badge>)}
                    {(seo.hashtags ?? []).length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                  </div>
                </div>
                <details className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Raw output</summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{raw}</pre>
                </details>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Section({ label, value, onCopy, multiline }: { label: string; value: string; onCopy: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => onCopy(value)} disabled={!value}><Copy className="mr-1 h-3.5 w-3.5" /> Copy</Button>
      </div>
      <div className={`rounded-xl border border-border bg-card/60 p-3 text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
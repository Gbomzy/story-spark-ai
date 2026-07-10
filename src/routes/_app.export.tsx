import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProjects } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, Loader2 } from "lucide-react";
import { downloadExport, previewText, projectToBundle, type ExportFormat } from "@/lib/exportEngine";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/export")({
  head: () => ({ meta: [{ title: "Export — StorySpark AI" }] }),
  component: ExportPage,
});

const SECTIONS = ["Story","Characters","Storyboard","Voice Script","Songs","Image Prompts","SEO"];

function ExportPage() {
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [projectId, setProjectId] = useState<string>("");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [selected, setSelected] = useState<Record<string, boolean>>(Object.fromEntries(SECTIONS.map((s) => [s, true])));
  const [busy, setBusy] = useState(false);

  const project = (projects ?? []).find((p) => p.id === projectId);
  const bundle = project ? projectToBundle(project as unknown as Record<string, unknown>) : null;
  const filtered = bundle ? { ...bundle, sections: bundle.sections.filter((s) => selected[s.title] !== false) } : null;

  const preview = filtered ? previewText(filtered, format === "pdf" || format === "docx" || format === "zip" ? "md" : format) : "";

  const run = async () => {
    if (!filtered) return;
    setBusy(true);
    try { await downloadExport(filtered, format); toast.success(`Exported as ${format.toUpperCase()}`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Export" description="Export any project as PDF, DOCX, TXT, Markdown, HTML, JSON or a full ZIP bundle." />
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>{(projects ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{(["pdf","docx","txt","md","html","json","zip"] as ExportFormat[]).map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full rounded-xl gradient-primary text-white shadow-glow" disabled={!project || busy} onClick={run}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Include sections</p>
          <div className="flex flex-wrap gap-3">
            {SECTIONS.map((s) => (
              <label key={s} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-1.5 text-xs">
                <Checkbox checked={selected[s] !== false} onCheckedChange={(v) => setSelected((x) => ({ ...x, [s]: !!v }))} /> {s}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Preview</div>
        <Textarea readOnly value={preview} className="min-h-[360px] rounded-2xl font-mono text-xs" placeholder="Choose a project to preview export contents…" />
      </Card>
    </div>
  );
}
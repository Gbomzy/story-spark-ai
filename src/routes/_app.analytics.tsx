import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { listHistory } from "@/lib/assets";
import { listProjects } from "@/lib/projects";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — StorySpark AI" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const hist = useQuery({ queryKey: ["an-hist"], queryFn: () => listHistory({ limit: 1000 }), refetchInterval: 20000 });
  const projects = useQuery({ queryKey: ["an-projects"], queryFn: () => listProjects() });
  const rows = hist.data ?? [];
  const projList = projects.data ?? [];

  const perProject = projList.map((p) => {
    const r = rows.filter((row) => row.project_id === p.id);
    const count = (t: string) => r.filter((x) => x.asset_type === t).length;
    return {
      id: p.id,
      name: p.name,
      stories: count("story"),
      images: count("generated_image"),
      videos: count("video"),
      voice: count("voice_audio"),
      subtitles: count("subtitle") + count("ocr"),
      exports: count("export"),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Per-project generation metrics across every AI capability." />
      <Card className="glass overflow-hidden rounded-3xl shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Project</th>
              <th className="p-3 text-right">Stories</th>
              <th className="p-3 text-right">Images</th>
              <th className="p-3 text-right">Videos</th>
              <th className="p-3 text-right">Voice</th>
              <th className="p-3 text-right">Subtitles/OCR</th>
              <th className="p-3 text-right">Exports</th>
            </tr>
          </thead>
          <tbody>
            {perProject.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No projects yet.</td></tr>
            ) : perProject.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-3 font-medium">{row.name}</td>
                <td className="p-3 text-right">{row.stories}</td>
                <td className="p-3 text-right">{row.images}</td>
                <td className="p-3 text-right">{row.videos}</td>
                <td className="p-3 text-right">{row.voice}</td>
                <td className="p-3 text-right">{row.subtitles}</td>
                <td className="p-3 text-right">{row.exports}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
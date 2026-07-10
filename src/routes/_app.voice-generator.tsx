import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, Sparkles, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { listProjects } from "@/lib/projects";
import { generateCosyVoice } from "@/lib/cosyvoice.functions";
import { audioService } from "@/lib/audioService";

export const Route = createFileRoute("/_app/voice-generator")({
  head: () => ({ meta: [{ title: "Voice Generator — StorySpark AI" }] }),
  component: VoiceGeneratorPage,
});

function VoiceGeneratorPage() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;
  const tts = useServerFn(generateCosyVoice);

  const mut = useMutation({
    mutationFn: () => tts({ data: { script: project?.voice ?? "", projectId: project?.id } }),
    onSuccess: () => { toast.success("Voice generated"); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Voice generation failed"),
  });

  const asset = audioService.parseAsset(
    project?.voice_audio ? JSON.stringify(project.voice_audio) : project?.audio ?? null
  );
  const script = project?.voice ?? "";

  if (isLoading) {
    return <div className="grid place-items-center py-24 text-sm text-muted-foreground"><Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader title="Voice Generator" description="Natural narrator voices powered by Alibaba Cloud CosyVoice." />

      {!project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first to generate voice narration.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow">
            <Link to="/story-generator">Start a story</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card className="glass rounded-3xl p-6 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Project</p>
                <h3 className="text-lg font-bold">{project.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">CosyVoice · Connected</Badge>
                <Badge variant="secondary" className="rounded-full">~{Math.max(1, Math.ceil(script.length / 400))} credits</Badge>
              </div>
            </div>

            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Voice script</p>
            <Textarea readOnly value={script} placeholder="No voice script yet — generate one from the project detail." className="min-h-[220px] rounded-2xl bg-card/60 leading-relaxed" />

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => mut.mutate()} disabled={!script || mut.isPending} className="rounded-xl gradient-primary text-white shadow-glow">
                {mut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-1.5 h-4 w-4" /> Generate voice</>}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(script); toast.success("Copied"); }}>
                <Copy className="mr-1.5 h-4 w-4" /> Copy script
              </Button>
              <Button asChild variant="outline" disabled={!asset.url} className="rounded-xl">
                {asset.url ? <a href={asset.url} download><Download className="mr-1.5 h-4 w-4" /> Download MP3</a> : <span><Download className="mr-1.5 h-4 w-4" /> Download MP3</span>}
              </Button>
            </div>

            <div className="mt-4">
              {asset.url ? (
                <audio controls src={asset.url} className="w-full" />
              ) : (
                <div className="grid h-14 place-items-center rounded-xl border border-dashed border-border text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> Playback appears here after generation.</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="glass rounded-3xl p-5 shadow-soft">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">History</p>
            {asset.url ? (
              <p className="text-sm">Latest render · <a href={asset.url} className="underline" target="_blank" rel="noreferrer">Download</a></p>
            ) : (
              <p className="text-sm text-muted-foreground">No renders yet.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
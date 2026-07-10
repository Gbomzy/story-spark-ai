import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Film, Download, Sparkles, Share2, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { listProjects, type ProjectRow } from "@/lib/projects";
import { videoService } from "@/lib/videoService";
import { generateWanVideo } from "@/lib/wanVideo.functions";
import { runFullMoviePipeline } from "@/lib/pipelineEngine.functions";
import { PIPELINE, stageStatus, type PipelineState } from "@/lib/pipeline";

export const Route = createFileRoute("/_app/video-studio")({
  head: () => ({ meta: [{ title: "Video Studio — StorySpark AI" }] }),
  component: VideoStudioPage,
});

function VideoStudioPage() {
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;
  const configured = videoService.isConfigured();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Video Studio"
        description="Preview and render the final animated video for your project. Powered by Alibaba Cloud Wan."
      />

      {isLoading ? (
        <Card className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground shadow-soft">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
        </Card>
      ) : !project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first to render a video.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow">
            <Link to="/story-generator">Start a story</Link>
          </Button>
        </Card>
      ) : (
        <VideoDetail project={project} configured={configured} />
      )}
    </div>
  );
}

function VideoDetail({ project, configured }: { project: ProjectRow; configured: boolean }) {
  const qc = useQueryClient();
  const generateVideo = useServerFn(generateWanVideo);
  const runPipeline = useServerFn(runFullMoviePipeline);

  const status = (project.render_status ?? "pending") as "pending" | "generating" | "completed" | "failed";
  const progress = project.render_progress ?? 0;
  const provider = project.video_provider ?? videoService.defaultProvider();
  const videoUrl = extractUrl(project.video_file);

  const videoMut = useMutation({
    mutationFn: () =>
      generateVideo({
        data: {
          projectId: project.id,
          prompt: (typeof project.story === "string" ? project.story : String(project.story ?? "")).slice(0, 800) || project.name || "Cinematic short film",
          mode: "t2v",
          duration: 5,
        },
      }),
    onSuccess: () => { toast.success("Video ready."); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Video generation failed."),
  });

  const pipelineMut = useMutation({
    mutationFn: () => runPipeline({ data: { projectId: project.id } }),
    onSuccess: () => { toast.success("Full movie pipeline complete."); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Pipeline failed."),
  });

  const busy = videoMut.isPending || pipelineMut.isPending;
  const pipelineState = (project.media_pipeline as PipelineState | null) ?? {};

  return (
    <>
      <Card className="glass overflow-hidden rounded-3xl p-0 shadow-soft">
        <div className="grid gap-0 md:grid-cols-[2fr,1fr]">
          <div className="relative aspect-video w-full bg-gradient-to-br from-primary/15 via-muted/40 to-accent/15">
            {videoUrl ? (
              <video src={videoUrl} controls className="h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Film className="h-10 w-10 opacity-50" />
                  <span className="text-xs uppercase tracking-wider">No render yet</span>
                </div>
              </div>
            )}
            <Badge className="absolute left-3 top-3 rounded-full bg-emerald-500/15 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Connected · Alibaba Cloud Wan
            </Badge>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Project</p>
              <h3 className="text-lg font-bold">{project.name}</h3>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Duration" value={project.render_duration ? `${project.render_duration}s` : project.duration ? `${project.duration} min` : "—"} />
              <Field label="Resolution" value="1280×720" />
              <Field label="Aspect ratio" value="16:9" />
              <Field label="Provider" value={provider} />
              <Field label="Model" value="wanx2.1-t2v-turbo" />
              <Field label="Status" value={status} />
              <Field label="Progress" value={`${progress}%`} />
            </dl>
            <div>
              <Progress value={progress} className="h-2" />
            </div>
            <div className="grid gap-2">
              <Button onClick={() => videoMut.mutate()} disabled={!configured || busy} className="rounded-xl gradient-primary text-white shadow-glow disabled:opacity-60">
                {videoMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Rendering…</> : <><Sparkles className="mr-1.5 h-4 w-4" /> Generate video</>}
              </Button>
              <Button onClick={() => pipelineMut.mutate()} disabled={!configured || busy} variant="secondary" className="rounded-xl">
                {pipelineMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating movie…</> : <><Wand2 className="mr-1.5 h-4 w-4" /> Generate entire movie</>}
              </Button>
              <Button asChild disabled={!videoUrl} variant="outline" className="rounded-xl">
                {videoUrl ? <a href={videoUrl} download><Download className="mr-1.5 h-4 w-4" /> Download MP4</a> : <span><Download className="mr-1.5 h-4 w-4" /> Download MP4</span>}
              </Button>
              <Button disabled={!videoUrl} variant="outline" className="rounded-xl">
                <Share2 className="mr-1.5 h-4 w-4" /> Publish
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-5 shadow-soft">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Pipeline stages</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PIPELINE.filter((s) => s.isMedia).map((s) => {
            const state = pipelineState[s.id] ?? stageStatus(project as unknown as Record<string, unknown>, s);
            const tone =
              state === "completed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : state === "generating" ? "bg-primary/15 text-primary"
              : state === "failed" ? "bg-destructive/15 text-destructive"
              : "bg-muted text-muted-foreground";
            return (
              <div key={s.id} className="flex items-center justify-between rounded-2xl border border-border bg-card/60 p-3">
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.description}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${tone}`}>{state}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="glass rounded-3xl p-5 shadow-soft">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Export</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ExportButton label="Images ZIP" disabled={!project.generated_images} />
          <ExportButton label="Voice MP3" disabled={!project.voice_audio} />
          <ExportButton label="Music MP3" disabled={!project.background_music} />
          <ExportButton label="Subtitles SRT" disabled={!project.subtitle_file} />
          <ExportButton label="Thumbnail PNG" disabled={!project.thumbnail} />
          <ExportButton label="Final MP4" disabled={!project.video_file} />
        </div>
      </Card>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function ExportButton({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <Button variant="outline" disabled={disabled} className="justify-start rounded-xl">
      <Download className="mr-1.5 h-4 w-4" /> {label}
    </Button>
  );
}

function extractUrl(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
  }
  return null;
}
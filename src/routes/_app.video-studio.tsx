import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
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
import { runFullMoviePipeline, type MovieManifest, type SceneClip } from "@/lib/pipelineEngine.functions";
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
  const manifest = parseManifest(project.video_file);
  const clips = manifest?.clips ?? [];
  const videoUrl = manifest?.url ?? extractUrl(project.video_file);
  const narrationUrl = manifest?.narrationUrl ?? extractUrl(project.voice_audio);
  const [perScene, setPerScene] = useState<number>(5);
  const [previewClip, setPreviewClip] = useState<SceneClip | null>(null);

  const videoMut = useMutation({
    mutationFn: () =>
      generateVideo({
        data: {
          projectId: project.id,
          prompt: (typeof project.story === "string" ? project.story : String(project.story ?? "")).slice(0, 800) || project.name || "Cinematic short film",
          mode: "t2v",
          duration: perScene,
        },
      }),
    onSuccess: () => { toast.success("Video ready."); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Video generation failed."),
  });

  const pipelineMut = useMutation({
    mutationFn: async () => {
      // Loop until the server reports the queue is fully drained.
      // Each invocation generates one clip → avoids Worker timeouts and
      // gives resume-from-interruption for free.
      let last: Awaited<ReturnType<typeof runPipeline>> | null = null;
      for (let i = 0; i < 200; i++) {
        last = await runPipeline({ data: { projectId: project.id, perSceneDuration: perScene, chainScenes: true } });
        const done = last?.results?.done ?? true;
        const remaining = last?.results?.queueRemaining ?? 0;
        const completed = last?.results?.queueCompleted ?? 0;
        const total = last?.results?.queueTotal ?? 0;
        qc.invalidateQueries({ queryKey: ["projects"] });
        if (done) break;
        if (total > 0) {
          toast.message(`Rendering clip ${completed}/${total}…`, { id: "movie-pipeline" });
        }
        if (remaining === 0) break;
      }
      return last;
    },
    onSuccess: (r) => {
      const n = r?.results?.clips?.filter((c) => c.url).length ?? 0;
      toast.success(n > 1 ? `Movie built from ${n} scene clips.` : "Movie ready.", { id: "movie-pipeline" });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message || "Pipeline failed."),
  });

  const busy = videoMut.isPending || pipelineMut.isPending;
  const pipelineState = (project.media_pipeline as PipelineState | null) ?? {};

  return (
    <>
      <Card className="glass overflow-hidden rounded-3xl p-0 shadow-soft">
        <div className="grid gap-0 md:grid-cols-[2fr,1fr]">
          <div className="relative aspect-video w-full bg-gradient-to-br from-primary/15 via-muted/40 to-accent/15">
            {clips.length > 1 ? (
              <ChainedMoviePlayer clips={clips} narrationUrl={narrationUrl ?? undefined} />
            ) : videoUrl ? (
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
              <Field label="Total length" value={manifest ? `${manifest.totalDurationSeconds}s` : project.render_duration ? `${project.render_duration}s` : "—"} />
              <Field label="Scene clips" value={clips.length ? String(clips.length) : "—"} />
              <Field label="Scenes" value={clips.length ? String(new Set(clips.map((c) => c.sceneNumber)).size) : "—"} />
              <Field label="Resolution" value="1280×720" />
              <Field label="Provider" value={provider} />
              <Field label="Model" value="wan2.7-t2v" />
              <Field label="Status" value={status} />
            </dl>
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Seconds per scene clip</p>
              <div className="flex gap-1.5">
                {[5, 8, 10].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={perScene === n ? "default" : "outline"}
                    onClick={() => setPerScene(n)}
                    className="rounded-lg"
                  >
                    {n}s
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Wan clips max out at ~10s. Longer movies are built by chaining one clip per storyboard scene.
              </p>
            </div>
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

      {clips.length > 0 ? (
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Scene clips ({clips.length})</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map((c) => (
              <button
                key={`${c.sceneNumber}-${c.clipNumber}-${c.url}`}
                onClick={() => setPreviewClip(c)}
                className="group flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 text-left transition hover:border-primary/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Scene {c.sceneNumber} · Part {c.clipNumber}</span>
                  <span className="text-[10px] text-muted-foreground">{c.durationSeconds}s</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatTime(c.startTime)} → {formatTime(c.endTime)}
                </div>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{c.prompt}</p>
                <span className="text-[10px] uppercase tracking-widest text-primary opacity-0 transition group-hover:opacity-100">Preview →</span>
              </button>
            ))}
          </div>
          {previewClip ? (
            <div className="mt-4 rounded-2xl border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold">Preview · Scene {previewClip.sceneNumber} · Part {previewClip.clipNumber}</span>
                <Button size="sm" variant="ghost" onClick={() => setPreviewClip(null)}>Close</Button>
              </div>
              <video src={previewClip.url} controls autoPlay className="aspect-video w-full rounded-xl bg-black" />
            </div>
          ) : null}
        </Card>
      ) : null}

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

function ChainedMoviePlayer({ clips, narrationUrl }: { clips: SceneClip[]; narrationUrl?: string }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = clips[idx];

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    if (playing) v.play().catch(() => { /* ignore */ });
  }, [idx, playing]);

  const play = async () => {
    setPlaying(true);
    setIdx(0);
    const v = videoRef.current;
    const a = audioRef.current;
    if (a) { a.currentTime = 0; a.play().catch(() => { /* ignore */ }); }
    if (v) { v.currentTime = 0; await v.play().catch(() => { /* ignore */ }); }
  };
  const pause = () => {
    setPlaying(false);
    videoRef.current?.pause();
    audioRef.current?.pause();
  };
  const onEnded = () => {
    if (idx < clips.length - 1) setIdx(idx + 1);
    else { setPlaying(false); audioRef.current?.pause(); }
  };

  if (!current) return null;
  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={videoRef}
        key={current.url}
        src={current.url}
        onEnded={onEnded}
        playsInline
        muted
        className="h-full w-full object-cover"
      />
      {narrationUrl ? <audio ref={audioRef} src={narrationUrl} preload="auto" /> : null}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
        <div className="text-[11px] uppercase tracking-widest opacity-80">
          Scene {idx + 1} / {clips.length} · {current.durationSeconds}s
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={playing ? pause : play}>
            {playing ? "Pause" : "Play movie"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
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

function parseManifest(v: unknown): MovieManifest | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.clips)) return null;
  return v as unknown as MovieManifest;
}
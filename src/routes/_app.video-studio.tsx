import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Film, Download, Sparkles, Share2, Loader2, Wand2, User, FolderOpen, Monitor, PlayCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { listProjects, type ProjectRow } from "@/lib/projects";
import { videoService } from "@/lib/videoService";
import { generateWanVideo } from "@/lib/wanVideo.functions";
import { runFullMoviePipeline, type MovieManifest, type SceneClip } from "@/lib/pipelineEngine.functions";
import { getRenderState, controlRender } from "@/lib/renderControls.functions";
import { PIPELINE, stageStatus, type PipelineState } from "@/lib/pipeline";
import { CHARACTER_PRESETS, findCharacter } from "@/lib/characters";

const ASPECT_SIZES: Record<"16:9" | "9:16" | "1:1" | "4:5", Record<"720p" | "1080p", string>> = {
  "16:9": { "720p": "1280*720", "1080p": "1920*1080" },
  "9:16": { "720p": "720*1280", "1080p": "1080*1920" },
  "1:1":  { "720p": "960*960",  "1080p": "1024*1024" },
  "4:5":  { "720p": "864*1080", "1080p": "864*1080" },
};

const PLATFORM_PRESETS: Array<{ id: string; label: string; ratio: "16:9" | "9:16" | "1:1" | "4:5"; resolution: "720p" | "1080p" }> = [
  { id: "yt",       label: "YouTube (16:9)",         ratio: "16:9", resolution: "1080p" },
  { id: "shorts",   label: "YouTube Shorts (9:16)",  ratio: "9:16", resolution: "1080p" },
  { id: "tiktok",   label: "TikTok (9:16)",          ratio: "9:16", resolution: "1080p" },
  { id: "reel",     label: "Instagram Reel (9:16)",  ratio: "9:16", resolution: "1080p" },
  { id: "sq",       label: "Instagram Square (1:1)", ratio: "1:1",  resolution: "1080p" },
  { id: "portrait", label: "Instagram Portrait (4:5)", ratio: "4:5", resolution: "1080p" },
];

export const Route = createFileRoute("/_app/video-studio")({
  head: () => ({ meta: [{ title: "Video Studio — StorySpark AI" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    projectId: typeof s.projectId === "string" ? s.projectId : undefined,
  }),
  component: VideoStudioPage,
});

function VideoStudioPage() {
  const search = useSearch({ from: "/_app/video-studio" });
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const configured = videoService.isConfigured();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedProjectId || !projects || projects.length === 0) return;
    if (search.projectId && projects.some((p) => p.id === search.projectId)) {
      setSelectedProjectId(search.projectId);
    } else {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, search.projectId]);
  const project = projects?.find((p) => p.id === selectedProjectId) ?? projects?.[0] ?? null;

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
        <>
          {projects && projects.length > 0 ? (
            <Card className="glass rounded-3xl p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Project</label>
                <select
                  value={project.id}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || "Untitled project"}</option>
                  ))}
                </select>
              </div>
            </Card>
          ) : null}
          <VideoDetail key={project.id} project={project} configured={configured} />
        </>
      )}
    </div>
  );
}

function VideoDetail({ project, configured }: { project: ProjectRow; configured: boolean }) {
  const qc = useQueryClient();
  const generateVideo = useServerFn(generateWanVideo);
  const runPipeline = useServerFn(runFullMoviePipeline);
  const readRenderState = useServerFn(getRenderState);
  const doControl = useServerFn(controlRender);

  // Authoritative render state from the durable queue. Every button and
  // counter reads from this so Video Studio, Create Movie, Render Dashboard,
  // Movie Composer, Dashboard, and Projects all display identical values.
  const renderQ = useQuery({
    queryKey: ["render-state", project.id],
    queryFn: () => readRenderState({ data: { projectId: project.id } }),
    refetchInterval: 4000,
  });
  const renderState = renderQ.data ?? null;

  // Scene count is derived ONLY from the storyboard (or the persisted
  // queue, which itself was built from the storyboard). Never inferred
  // from a single-shot fallback clip.
  const storyboardScenes = countStoryboardScenes(project.storyboard, project.images);

  const status = (project.render_status ?? "pending") as "pending" | "generating" | "completed" | "failed";
  const progress = renderState?.progress ?? project.render_progress ?? 0;
  const provider = project.video_provider ?? videoService.defaultProvider();
  const manifest = parseManifest(project.video_file);
  const clips = manifest?.clips ?? [];
  const videoUrl = manifest?.url ?? extractUrl(project.video_file);
  const narrationUrl = manifest?.narrationUrl ?? extractUrl(project.voice_audio);

  const queueTotal = renderState?.total ?? clips.length;
  const queueCompleted = renderState?.completed ?? clips.filter((c) => c.status === "completed").length;
  const queueFailed = renderState?.failed ?? clips.filter((c) => c.status === "failed").length;
  const queueRemaining = renderState?.remaining ?? Math.max(0, queueTotal - queueCompleted - queueFailed);
  const sceneCount = storyboardScenes || (renderState ? new Set(renderState.clips.map((c) => c.sceneNumber)).size : new Set(clips.map((c) => c.sceneNumber)).size);

  // Primary CTA state — see FIX 3 / FIX 7 / FIX 8. This is the single
  // source of truth for the button; Video Studio never opens a new
  // pipeline when one already exists for the project.
  const primary = derivePrimaryAction({
    hasJob: Boolean(renderState?.jobId),
    jobStatus: renderState?.status ?? null,
    total: queueTotal,
    completed: queueCompleted,
    failed: queueFailed,
  });

  const [perScene, setPerScene] = useState<number>(5);
  const [previewClip, setPreviewClip] = useState<SceneClip | null>(null);
  const [characterId, setCharacterId] = useState<string>("none");
  const [customCharacter, setCustomCharacter] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1" | "4:5">("16:9");
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  // Low-Cost Test Mode — caps the render to the first 3 scenes so a
  // quality pass costs a fraction of a full 13-scene movie.
  const [testMode, setTestMode] = useState<boolean>(false);
  const size = ASPECT_SIZES[aspectRatio][resolution];
  const selectedCharacter =
    characterId === "none"
      ? null
      : characterId === "custom"
        ? { name: customCharacter.trim(), description: "" }
        : findCharacter(characterId);

  const videoMut = useMutation({
    mutationFn: () =>
      generateVideo({
        data: {
          projectId: project.id,
          prompt: (typeof project.story === "string" ? project.story : String(project.story ?? "")).slice(0, 800) || project.name || "Cinematic short film",
          mode: "t2v",
          duration: perScene,
          size,
        },
      }),
    onSuccess: () => { toast.success("Video ready."); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Video generation failed."),
  });

  const pipelineMut = useMutation({
    mutationFn: async () => {
      // FIX 9 — Project Integrity Check + Repair. If failed clips exist,
      // requeue them first via the durable controller so we never open a
      // parallel pipeline just to retry.
      if (primary === "repair" && renderState?.jobId) {
        await doControl({ data: { projectId: project.id, action: "retry_failed" } }).catch(() => {});
      } else if (primary === "resume" && renderState?.status === "paused") {
        await doControl({ data: { projectId: project.id, action: "resume" } }).catch(() => {});
      }
      // Loop until the server reports the queue is fully drained.
      // Each invocation generates one clip → avoids Worker timeouts and
      // gives resume-from-interruption for free.
      let last: Awaited<ReturnType<typeof runPipeline>> | null = null;
      for (let i = 0; i < 200; i++) {
        last = await runPipeline({
          data: {
            projectId: project.id,
            perSceneDuration: perScene,
            chainScenes: true,
            size,
            ...(testMode ? { testMode: true, maxScenes: 3 } : {}),
            ...(selectedCharacter?.name ? { characterName: selectedCharacter.name } : {}),
            ...(selectedCharacter && "description" in selectedCharacter && selectedCharacter.description
              ? { characterDescription: selectedCharacter.description }
              : {}),
          },
        });
        const done = last?.results?.done ?? true;
        const remaining = last?.results?.queueRemaining ?? 0;
        const completed = last?.results?.queueCompleted ?? 0;
        const total = last?.results?.queueTotal ?? 0;
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["render-state", project.id] });
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
      qc.invalidateQueries({ queryKey: ["render-state", project.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Pipeline failed."),
  });

  const regenSceneMut = useMutation({
    mutationFn: async (sceneNumber: number) => {
      let last: Awaited<ReturnType<typeof runPipeline>> | null = null;
      for (let i = 0; i < 40; i++) {
        last = await runPipeline({
          data: {
            projectId: project.id,
            perSceneDuration: perScene,
            chainScenes: true,
            size,
            regenerateSceneOnly: sceneNumber,
            ...(selectedCharacter?.name ? { characterName: selectedCharacter.name } : {}),
            ...(selectedCharacter && "description" in selectedCharacter && selectedCharacter.description
              ? { characterDescription: selectedCharacter.description }
              : {}),
          },
        });
        qc.invalidateQueries({ queryKey: ["projects"] });
        qc.invalidateQueries({ queryKey: ["render-state", project.id] });
        if (last?.results?.done) break;
        if ((last?.results?.queueRemaining ?? 0) === 0) break;
      }
      return last;
    },
    onSuccess: () => toast.success("Scene regenerated.", { id: "regen-scene" }),
    onError: (e: Error) => toast.error(e.message || "Regeneration failed."),
  });

  const busy = videoMut.isPending || pipelineMut.isPending;
  const pipelineState = (project.media_pipeline as PipelineState | null) ?? {};

  // Standalone single-clip generation is only valid when the project has
  // exactly one storyboard scene (FIX 4). Otherwise it would fork a
  // second pipeline that overrides the multi-scene queue.
  const allowStandalone = sceneCount <= 1;

  async function downloadAllClips() {
    if (!clips.length) return;
    toast.message(`Downloading ${clips.length} clip(s)…`, { id: "dl-all" });
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      if (!c.url) continue;
      try {
        const res = await fetch(c.url);
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${project.name || "movie"}_scene-${c.sceneNumber}_part-${c.clipNumber}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 4000);
      } catch {
        // fall back to opening in a new tab so the user can still save it
        window.open(c.url, "_blank", "noopener");
      }
      // small gap so browsers don't drop rapid downloads
      await new Promise((r) => setTimeout(r, 400));
    }
    if (narrationUrl) {
      try {
        const res = await fetch(narrationUrl);
        const blob = await res.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${project.name || "movie"}_narration.mp3`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 4000);
      } catch { /* best effort */ }
    }
    toast.success("Movie files saved to your Downloads folder.", { id: "dl-all" });
  }

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
              <Field label="Scene clips" value={queueTotal ? `${queueCompleted}/${queueTotal}` : "—"} />
              <Field label="Scenes" value={sceneCount ? String(sceneCount) : "—"} />
              <Field label="Resolution" value={size.replace("*", "×")} />
              <Field label="Aspect" value={aspectRatio} />
              <Field label="Provider" value={provider} />
              <Field label="Model" value="wan2.7-t2v" />
              <Field label="Status" value={renderState?.status ?? status} />
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
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <User className="h-3 w-3" /> Main character
              </div>
              <select
                value={characterId}
                onChange={(e) => setCharacterId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="none">No fixed character</option>
                {CHARACTER_PRESETS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.trait}</option>
                ))}
                <option value="custom">Custom name…</option>
              </select>
              {characterId === "custom" ? (
                <input
                  value={customCharacter}
                  onChange={(e) => setCustomCharacter(e.target.value)}
                  placeholder="e.g. Lily"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                />
              ) : null}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Picking the same character (or typing the same custom name) keeps them looking consistent across every movie.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Monitor className="h-3 w-3" /> Format & platform
              </div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Preset</p>
              <select
                value={PLATFORM_PRESETS.find((p) => p.ratio === aspectRatio && p.resolution === resolution)?.id ?? ""}
                onChange={(e) => {
                  const p = PLATFORM_PRESETS.find((x) => x.id === e.target.value);
                  if (p) { setAspectRatio(p.ratio); setResolution(p.resolution); }
                }}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="">Custom…</option>
                {PLATFORM_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} · {p.resolution}</option>
                ))}
              </select>
              <p className="mb-1 mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Aspect ratio</p>
              <div className="flex flex-wrap gap-1.5">
                {(["16:9", "9:16", "1:1", "4:5"] as const).map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={aspectRatio === r ? "default" : "outline"}
                    onClick={() => setAspectRatio(r)}
                    className="rounded-lg"
                  >
                    {r}
                  </Button>
                ))}
              </div>
              <p className="mb-1 mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Resolution</p>
              <div className="flex gap-1.5">
                {(["720p", "1080p"] as const).map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={resolution === r ? "default" : "outline"}
                    onClick={() => setResolution(r)}
                    className="rounded-lg"
                  >
                    {r.toUpperCase()}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Output size: <span className="font-mono">{size.replace("*", "×")}</span>
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <div>
                <p className="text-xs font-semibold">Low-Cost Test Mode</p>
                <p className="text-[10px] text-muted-foreground">
                  Renders only the first 3 scenes (~20–30s) so you can preview
                  quality without paying for the full movie. Turn off before
                  the final render.
                </p>
              </div>
            </label>
            <div>
              <Progress value={progress} className="h-2" />
              {queueTotal > 0 ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {queueCompleted}/{queueTotal} clips · {queueRemaining} remaining
                  {queueFailed ? ` · ${queueFailed} failed` : ""}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <PrimaryMovieButton
                action={primary}
                projectId={project.id}
                busy={busy}
                disabled={!configured}
                pending={pipelineMut.isPending}
                onRun={() => pipelineMut.mutate()}
              />
              {allowStandalone ? (
                <Button
                  onClick={() => videoMut.mutate()}
                  disabled={!configured || busy}
                  variant="outline"
                  className="rounded-xl"
                  title="Single-scene projects only"
                >
                  {videoMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Rendering…</> : <><Sparkles className="mr-1.5 h-4 w-4" /> Generate single clip</>}
                </Button>
              ) : null}
              <Button asChild disabled={!videoUrl} variant="outline" className="rounded-xl">
                {videoUrl ? <a href={videoUrl} download><Download className="mr-1.5 h-4 w-4" /> Download MP4</a> : <span><Download className="mr-1.5 h-4 w-4" /> Download MP4</span>}
              </Button>
              <Button onClick={downloadAllClips} disabled={clips.length === 0} variant="outline" className="rounded-xl">
                <Download className="mr-1.5 h-4 w-4" /> Download entire movie ({clips.length || 0} clips)
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

/** Count scenes from the persisted storyboard. Mirrors the server-side
 *  parser (blank-line split) so the UI reports the same scene count the
 *  render pipeline will produce. Falls back to the persisted image list
 *  when the storyboard column is a structured JSON payload. */
function countStoryboardScenes(storyboard: unknown, images: unknown): number {
  if (typeof storyboard === "string" && storyboard.trim()) {
    const raw = storyboard.replace(/\r\n/g, "\n");
    const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const headingHits = (raw.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:Scene|SCENE|scene)\s+\d+\b/g) ?? []).length;
    if (headingHits >= 2 && blocks.length < headingHits) return Math.min(headingHits, 40);
    if (blocks.length < 2) {
      const numHits = (raw.match(/(?:^|\n)\s*\d{1,2}[.)]\s+/g) ?? []).length;
      if (numHits >= 2) return Math.min(numHits, 40);
    }
    return blocks.slice(0, 40).length;
  }
  if (storyboard && typeof storyboard === "object") {
    const o = storyboard as Record<string, unknown>;
    if (Array.isArray(o.scenes)) return o.scenes.length;
  }
  if (Array.isArray(images)) return (images as unknown[]).length;
  if (images && typeof images === "object") {
    const o = images as Record<string, unknown>;
    if (Array.isArray(o.scenes)) return (o.scenes as unknown[]).length;
  }
  return 0;
}

type PrimaryAction = "generate" | "resume" | "repair" | "open";

function derivePrimaryAction(input: {
  hasJob: boolean;
  jobStatus: string | null;
  total: number;
  completed: number;
  failed: number;
}): PrimaryAction {
  const { hasJob, jobStatus, total, completed, failed } = input;
  if (hasJob && total > 0 && completed >= total && failed === 0) return "open";
  if (jobStatus === "completed" && failed === 0) return "open";
  if (failed > 0) return "repair";
  if (hasJob && jobStatus && ["generating", "queued", "paused", "stalled", "rendering", "processing"].includes(jobStatus)) return "resume";
  return "generate";
}

function PrimaryMovieButton({
  action,
  projectId: _projectId,
  busy,
  disabled,
  pending,
  onRun,
}: {
  action: PrimaryAction;
  projectId: string;
  busy: boolean;
  disabled: boolean;
  pending: boolean;
  onRun: () => void;
}) {
  if (action === "open") {
    return (
      <Button asChild className="rounded-xl gradient-primary text-white shadow-glow">
        <Link to="/movie-composer">
          <Film className="mr-1.5 h-4 w-4" /> Open Movie Composer
        </Link>
      </Button>
    );
  }
  const label =
    action === "repair" ? "Repair Movie" :
    action === "resume" ? "Resume Movie" :
    "Generate Movie";
  const Icon =
    action === "repair" ? Wrench :
    action === "resume" ? PlayCircle :
    Wand2;
  return (
    <Button
      onClick={onRun}
      disabled={disabled || busy}
      className="rounded-xl gradient-primary text-white shadow-glow disabled:opacity-60"
    >
      {pending ? (
        <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> {action === "repair" ? "Repairing…" : action === "resume" ? "Resuming…" : "Generating…"}</>
      ) : (
        <><Icon className="mr-1.5 h-4 w-4" /> {label}</>
      )}
    </Button>
  );
}
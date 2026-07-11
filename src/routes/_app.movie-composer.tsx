import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Film, Download, Loader2, ArrowUp, ArrowDown, Trash2, Copy, RefreshCw, Scissors, Play, Wand2, Package, Music, Type,
  CheckCircle2, XCircle, Clock, RotateCcw, SkipForward, PartyPopper, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { listProjects, type ProjectRow } from "@/lib/projects";
import type { MovieManifest, SceneClip } from "@/lib/pipelineEngine.functions";
import { runFullMoviePipeline } from "@/lib/pipelineEngine.functions";
import { saveMovieManifest, regenerateClip } from "@/lib/movieManifest.functions";
import { composeMovie, type ComposerSettings } from "@/lib/movieComposer";
import { downloadMoviePackage } from "@/lib/moviePackaging";
import { buildSubtitles } from "@/lib/subtitleService";

export const Route = createFileRoute("/_app/movie-composer")({
  head: () => ({ meta: [{ title: "Movie Composer — StorySpark AI" }] }),
  component: MovieComposerPage,
});

function MovieComposerPage() {
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Movie Composer"
        description="Stitch every generated scene clip into a single downloadable movie. Reorder, trim, replace and preview — all in the browser."
      />
      {isLoading ? (
        <Card className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground shadow-soft">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading projects…
        </Card>
      ) : !project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first, then generate scene clips.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow">
            <Link to="/story-generator">Start a story</Link>
          </Button>
        </Card>
      ) : (
        <ComposerBody project={project} />
      )}
    </div>
  );
}

function ComposerBody({ project }: { project: ProjectRow }) {
  const qc = useQueryClient();
  const initial = (project.video_file as MovieManifest | null) ?? null;
  const [clips, setClips] = useState<SceneClip[]>(initial?.clips ?? []);
  const [settings, setSettings] = useState<ComposerSettings>({
    resolution: initial?.resolution ?? "720p",
    aspectRatio: initial?.aspectRatio ?? "16:9",
    fps: (initial?.fps as 24 | 30 | 60) ?? 30,
    quality: initial?.quality ?? "standard",
    transition: initial?.transition ?? "crossfade",
    transitionDuration: initial?.transitionDuration ?? 0.6,
    burnSubtitles: initial?.burnSubtitles ?? true,
    subtitleText: extractText(project.voice) || "",
    subtitlePosition: initial?.subtitlePosition ?? "bottom",
  });
  const [progress, setProgress] = useState<{ stage: string; percent: number; label?: string } | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [renderedExt, setRenderedExt] = useState<"webm" | "mp4">("webm");
  const [previewClip, setPreviewClip] = useState<SceneClip | null>(null);
  const renderStart = useRef<number>(0);
  const [renderMs, setRenderMs] = useState<number>(0);

  // Render queue instrumentation
  const [failedIdx, setFailedIdx] = useState<Set<number>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [renderStartAt, setRenderStartAt] = useState<number | null>(null);
  const clipTimesRef = useRef<number[]>([]);
  const lastTickRef = useRef<number>(0);
  const [tick, setTick] = useState(0); // forces re-render for elapsed clock
  const autoFinalizedRef = useRef(false);
  const autoResumedRef = useRef(false);

  const narrationUrl = extractUrl(project.voice_audio) ?? initial?.narrationUrl;

  const totalDuration = useMemo(
    () => clips.reduce((n, c) => n + Math.max(0.5, c.durationSeconds - (c.trimStart ?? 0) - (c.trimEnd ?? 0)), 0),
    [clips],
  );

  const persist = useServerFn(saveMovieManifest);
  const regen = useServerFn(regenerateClip);
  const runPipeline = useServerFn(runFullMoviePipeline);

  const saveMut = useMutation({
    mutationFn: () =>
      persist({
        data: {
          projectId: project.id,
          manifest: {
            kind: clips.length > 1 ? "chained" : "single",
            url: clips[0]?.url ?? "",
            clips,
            narrationUrl,
            provider: initial?.provider ?? "wan",
            totalDurationSeconds: totalDuration,
            transition: settings.transition,
            transitionDuration: settings.transitionDuration,
            resolution: settings.resolution,
            aspectRatio: settings.aspectRatio,
            fps: settings.fps,
            quality: settings.quality,
            burnSubtitles: settings.burnSubtitles,
            subtitlePosition: settings.subtitlePosition,
          },
        },
      }),
    onSuccess: () => { toast.success("Timeline saved."); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Save failed."),
  });

  const pipelineMut = useMutation({
    mutationFn: async () => {
      let last: Awaited<ReturnType<typeof runPipeline>> | null = null;
      if (renderStartAt == null) setRenderStartAt(Date.now());
      clipTimesRef.current = clipTimesRef.current.length ? clipTimesRef.current : [];
      let lastCompleted = clips.filter((c) => c.url).length;
      lastTickRef.current = performance.now();
      for (let i = 0; i < 500; i++) {
        const t0 = performance.now();
        try {
          last = await runPipeline({ data: { projectId: project.id, chainScenes: true, maxClipsPerCall: 1 } });
        } catch (err) {
          // Mark the first pending clip as failed and continue to next.
          setFailedIdx((prev) => {
            const next = new Set(prev);
            const pendingAt = clips.findIndex((c) => !c.url && !prev.has(clips.indexOf(c)));
            if (pendingAt >= 0) next.add(pendingAt);
            return next;
          });
          throw err;
        }
        const dt = (performance.now() - t0) / 1000;
        const completed = last?.results?.queueCompleted ?? lastCompleted;
        const total = last?.results?.queueTotal ?? 0;
        if (completed > lastCompleted) {
          clipTimesRef.current.push(dt);
          lastCompleted = completed;
        }
        const nextClips = last?.results?.clips as SceneClip[] | undefined;
        if (nextClips) setClips(nextClips);
        setActiveIdx(nextClips ? nextClips.findIndex((c) => !c.url) : null);
        qc.invalidateQueries({ queryKey: ["projects"] });
        if (last?.results?.done) break;
        if (total > 0) toast.message(`Rendering clip ${completed}/${total}…`, { id: "movie-pipeline" });
      }
      setActiveIdx(null);
      return last;
    },
    onSuccess: () => {
      toast.success("All clips rendered.", { id: "movie-pipeline" });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message || "Pipeline failed."),
  });

  const regenMut = useMutation({
    mutationFn: (c: SceneClip) => regen({ data: { projectId: project.id, sceneNumber: c.sceneNumber, clipNumber: c.clipNumber, prompt: c.prompt, duration: Math.max(2, Math.min(10, Math.round(c.durationSeconds))) } }),
    onSuccess: (r) => {
      const m = (r as { manifest?: MovieManifest }).manifest;
      if (m) setClips(m.clips);
      toast.success("Clip regenerated.");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message || "Regeneration failed."),
  });

  const render = async () => {
    if (!clips.length) { toast.error("No scene clips to compose. Run the pipeline first."); return; }
    setProgress({ stage: "loading", percent: 0, label: "Preparing clips…" });
    setRenderedUrl(null);
    setRenderedBlob(null);
    renderStart.current = performance.now();
    try {
      const { blob, ext } = await composeMovie(
        {
          kind: clips.length > 1 ? "chained" : "single",
          url: clips[0]?.url ?? "",
          clips,
          narrationUrl,
          provider: initial?.provider ?? "wan",
          totalDurationSeconds: totalDuration,
        },
        narrationUrl ?? undefined,
        settings,
        (info) => setProgress({ stage: info.stage, percent: info.percent, label: info.stage === "rendering" ? `Rendering clip ${info.clip}/${info.totalClips}` : info.stage }),
      );
      setRenderedBlob(blob);
      setRenderedExt(ext);
      setRenderedUrl(URL.createObjectURL(blob));
      setRenderMs(performance.now() - renderStart.current);
      toast.success(`Movie composed (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Compose failed.";
      toast.error(msg + " — falling back to ZIP export is recommended.");
    } finally {
      setProgress(null);
    }
  };

  const downloadMovie = () => {
    if (!renderedBlob) return;
    saveAs(renderedBlob, `${safeName(project.name)}.${renderedExt}`);
  };

  const downloadZip = async () => {
    const subs = buildSubtitles(settings.subtitleText ?? "");
    await downloadMoviePackage({
      name: project.name,
      project: project as unknown as Record<string, unknown>,
      videoUrl: renderedUrl ?? clips[0]?.url,
      narrationUrl: narrationUrl ?? undefined,
      subtitles: subs.srt,
      subtitleFormat: "srt",
      images: parseImages(project.generated_images),
    });
    toast.success("Movie package downloaded.");
  };

  const downloadSubs = (format: "srt" | "vtt") => {
    const subs = buildSubtitles(settings.subtitleText ?? "");
    const blob = new Blob([format === "srt" ? subs.srt : subs.vtt], { type: "text/plain" });
    saveAs(blob, `${safeName(project.name)}.${format}`);
  };

  const downloadNarration = async () => {
    if (!narrationUrl) return;
    const r = await fetch(narrationUrl);
    saveAs(await r.blob(), `${safeName(project.name)}-narration.mp3`);
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...clips];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    // renumber clip order within scene chains
    setClips(renumber(next));
  };
  const remove = (i: number) => setClips(renumber(clips.filter((_, idx) => idx !== i)));
  const duplicate = (i: number) => {
    const c = clips[i];
    const copy: SceneClip = { ...c };
    const next = [...clips.slice(0, i + 1), copy, ...clips.slice(i + 1)];
    setClips(renumber(next));
  };
  const setTrim = (i: number, patch: Partial<Pick<SceneClip, "trimStart" | "trimEnd">>) => {
    const next = clips.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setClips(next);
  };
  const setPrompt = (i: number, prompt: string) => {
    const next = clips.map((c, idx) => (idx === i ? { ...c, prompt } : c));
    setClips(next);
  };

  // Retry a failed clip in place (regenerate it), keeping the manifest intact.
  const retryClip = (i: number) => {
    const c = clips[i];
    if (!c) return;
    setFailedIdx((p) => { const n = new Set(p); n.delete(i); return n; });
    regenMut.mutate(c);
  };

  // Skip a failed clip — drop it from the queue and continue rendering.
  const skipClip = (i: number) => {
    setFailedIdx((p) => { const n = new Set(p); n.delete(i); return n; });
    setClips(renumber(clips.filter((_, idx) => idx !== i)));
    toast.message("Clip skipped.");
  };

  // Auto-resume: on mount, if the manifest has pending clips, continue rendering.
  useEffect(() => {
    if (autoResumedRef.current) return;
    autoResumedRef.current = true;
    const hasPending = clips.some((c) => !c.url);
    if (hasPending && !pipelineMut.isPending) {
      toast.message("Resuming render from last checkpoint…");
      pipelineMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-finalize: once all clips are rendered, automatically compose the movie.
  useEffect(() => {
    if (autoFinalizedRef.current) return;
    if (pipelineMut.isPending) return;
    if (clips.length === 0) return;
    if (clips.some((c) => !c.url)) return;
    if (renderedUrl || progress) return;
    autoFinalizedRef.current = true;
    void render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, pipelineMut.isPending]);

  // 1Hz tick for the elapsed clock while rendering
  useEffect(() => {
    if (!pipelineMut.isPending) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [pipelineMut.isPending]);

  // Persist a Render History entry on success.
  useEffect(() => {
    if (!renderedUrl || !renderStartAt) return;
    saveRenderHistory({
      projectId: project.id,
      name: project.name,
      startTime: renderStartAt,
      endTime: Date.now(),
      durationMs: Date.now() - renderStartAt,
      provider: initial?.provider ?? "wan",
      clips: clips.length,
      failed: failedIdx.size,
      status: failedIdx.size ? "partial" : "success",
      avgClipSeconds: clipTimesRef.current.length
        ? clipTimesRef.current.reduce((a, b) => a + b, 0) / clipTimesRef.current.length
        : 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderedUrl]);

  // Derived stats for the progress dashboard.
  const completedCount = clips.filter((c) => c.url).length;
  const totalCount = clips.length;
  const overallPct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const avgClipSec = clipTimesRef.current.length
    ? clipTimesRef.current.reduce((a, b) => a + b, 0) / clipTimesRef.current.length
    : 0;
  const remainingClips = Math.max(0, totalCount - completedCount);
  const etaSec = avgClipSec > 0 ? Math.round(avgClipSec * remainingClips) : 0;
  const elapsedSec = renderStartAt ? Math.round((Date.now() - renderStartAt) / 1000) : 0;
  void tick; // referenced so ESLint/consumers know it drives re-renders
  const currentClip = activeIdx != null ? clips[activeIdx] : clips.find((c) => !c.url) ?? null;

  return (
    <>
      <Card className="glass rounded-3xl p-5 shadow-soft sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Active project</p>
            <h3 className="text-lg font-bold">{project.name}</h3>
            <p className="text-xs text-muted-foreground">
              {clips.length} clip{clips.length === 1 ? "" : "s"} · {totalDuration.toFixed(1)}s total
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => pipelineMut.mutate()} disabled={pipelineMut.isPending}>
              {pipelineMut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating…</> : <><Wand2 className="mr-1.5 h-4 w-4" /> Generate clips</>}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Save timeline
            </Button>
            <Button className="rounded-xl gradient-primary text-white shadow-glow" onClick={render} disabled={!!progress || clips.length === 0}>
              {progress ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> {progress.label ?? "Rendering…"}</> : <><Film className="mr-1.5 h-4 w-4" /> Compose movie</>}
            </Button>
          </div>
        </div>
        {progress ? (
          <div className="mb-4">
            <Progress value={progress.percent} className="h-2" />
            <p className="mt-1 text-[11px] text-muted-foreground">{Math.round(progress.percent)}% · {progress.label}</p>
          </div>
        ) : null}
        <SettingsPanel settings={settings} onChange={setSettings} />
      </Card>

      {(pipelineMut.isPending || (totalCount > 0 && completedCount < totalCount)) && (
        <ProgressDashboard
          completed={completedCount}
          total={totalCount}
          overallPct={overallPct}
          current={currentClip}
          provider={currentClip?.provider ?? initial?.provider ?? "wan"}
          avgClipSec={avgClipSec}
          etaSec={etaSec}
          elapsedSec={elapsedSec}
          renderStartAt={renderStartAt}
        />
      )}

      <RenderQueuePanel
        clips={clips}
        activeIdx={activeIdx}
        failed={failedIdx}
        retryingAny={regenMut.isPending}
        onRetry={retryClip}
        onSkip={skipClip}
        onPreview={setPreviewClip}
      />

      <Card className="glass rounded-3xl p-5 shadow-soft">
        <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Timeline</p>
        {clips.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No scene clips yet. Click <strong>Generate clips</strong> above to run the full media pipeline.
          </div>
        ) : (
          <div className="space-y-2">
            {clips.map((c, i) => (
              <div key={`${c.sceneNumber}-${c.clipNumber}-${i}`} className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card/60 p-3 md:grid-cols-[auto,1fr,auto]">
                <div className="flex flex-col items-start gap-1 md:w-40">
                  <Badge className="rounded-full bg-primary/15 text-[10px] text-primary">Scene {c.sceneNumber} · Clip {c.clipNumber}</Badge>
                  <span className="text-[10px] text-muted-foreground">{formatTime(c.startTime)} → {formatTime(c.endTime)}</span>
                  <span className="text-[10px] text-muted-foreground">{c.durationSeconds.toFixed(1)}s · {c.provider}</span>
                </div>
                <div className="min-w-0 space-y-2">
                  <textarea
                    value={c.prompt}
                    onChange={(e) => setPrompt(i, e.target.value)}
                    className="w-full resize-none rounded-lg border border-border bg-background/60 p-2 text-xs"
                    rows={2}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <Scissors className="h-3 w-3" /> Trim start (s)
                      <Input
                        type="number" min={0} step={0.1}
                        value={c.trimStart ?? 0}
                        onChange={(e) => setTrim(i, { trimStart: Math.max(0, Number(e.target.value)) })}
                        className="h-7 w-20 text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      Trim end (s)
                      <Input
                        type="number" min={0} step={0.1}
                        value={c.trimEnd ?? 0}
                        onChange={(e) => setTrim(i, { trimEnd: Math.max(0, Number(e.target.value)) })}
                        className="h-7 w-20 text-xs"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap items-start justify-end gap-1">
                  <Button size="icon" variant="ghost" title="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Duplicate" onClick={() => duplicate(i)}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Preview" onClick={() => setPreviewClip(c)}><Play className="h-4 w-4" /></Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Regenerate"
                    onClick={() => regenMut.mutate(c)}
                    disabled={regenMut.isPending}
                  >
                    {regenMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" title="Delete" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {previewClip ? (
          <div className="mt-4 rounded-2xl border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">Preview · Scene {previewClip.sceneNumber} · Clip {previewClip.clipNumber}</span>
              <Button size="sm" variant="ghost" onClick={() => setPreviewClip(null)}>Close</Button>
            </div>
            <video src={previewClip.url} controls autoPlay className="aspect-video w-full rounded-xl bg-black" />
          </div>
        ) : null}
      </Card>

      {renderedUrl ? (
        <Card className="glass rounded-3xl p-6 text-center shadow-soft">
          <PartyPopper className="mx-auto mb-2 h-8 w-8 text-primary" />
          <h3 className="text-xl font-bold">Movie completed successfully</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Runtime {totalDuration.toFixed(1)}s · {new Set(clips.map((c) => c.sceneNumber)).size} scenes · {clips.length} clips ·
            {" "}{settings.resolution} · {settings.fps}fps · {(renderMs / 1000).toFixed(1)}s render · {initial?.provider ?? "wan"}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button className="rounded-xl gradient-primary text-white shadow-glow" onClick={() => renderedUrl && window.open(renderedUrl, "_blank")}>
              <Play className="mr-1.5 h-4 w-4" /> Watch movie
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={downloadMovie}>
              <Download className="mr-1.5 h-4 w-4" /> Download {renderedExt.toUpperCase()}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={downloadZip}>
              <Package className="mr-1.5 h-4 w-4" /> Download ZIP
            </Button>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/publishing"><Upload className="mr-1.5 h-4 w-4" /> Publish</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {renderedUrl ? (
        <Card className="glass rounded-3xl p-5 shadow-soft">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Movie ready</p>
              <p className="text-sm font-semibold">{project.name}.{renderedExt}</p>
              <p className="text-[11px] text-muted-foreground">
                {clips.length} clips · {totalDuration.toFixed(1)}s · {settings.resolution} {settings.aspectRatio} · {settings.fps}fps · {settings.quality} · render {(renderMs / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-xl gradient-primary text-white shadow-glow" onClick={downloadMovie}>
                <Download className="mr-1.5 h-4 w-4" /> Download {renderedExt.toUpperCase()}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={downloadZip}><Package className="mr-1.5 h-4 w-4" /> Movie ZIP</Button>
              <Button variant="outline" className="rounded-xl" onClick={downloadNarration} disabled={!narrationUrl}><Music className="mr-1.5 h-4 w-4" /> Narration</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => downloadSubs("srt")}><Type className="mr-1.5 h-4 w-4" /> SRT</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => downloadSubs("vtt")}><Type className="mr-1.5 h-4 w-4" /> VTT</Button>
            </div>
          </div>
          <video src={renderedUrl} controls className="aspect-video w-full rounded-2xl bg-black" />
        </Card>
      ) : null}

      <RenderHistoryPanel />
    </>
  );
}

function SettingsPanel({ settings, onChange }: { settings: ComposerSettings; onChange: (s: ComposerSettings) => void }) {
  const set = <K extends keyof ComposerSettings>(k: K, v: ComposerSettings[K]) => onChange({ ...settings, [k]: v });
  const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
  const Chip = <V extends string | number>({ v, cur, on, children }: { v: V; cur: V; on: (v: V) => void; children: React.ReactNode }) => (
    <Button size="sm" variant={cur === v ? "default" : "outline"} className="rounded-lg" onClick={() => on(v)}>{children}</Button>
  );
  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-card/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <Group label="Resolution">
        {(["720p", "1080p"] as const).map((v) => <Chip key={v} v={v} cur={settings.resolution} on={(x) => set("resolution", x)}>{v.toUpperCase()}</Chip>)}
      </Group>
      <Group label="Aspect ratio">
        {(["16:9", "9:16", "1:1", "4:5"] as const).map((v) => <Chip key={v} v={v} cur={settings.aspectRatio} on={(x) => set("aspectRatio", x)}>{v}</Chip>)}
      </Group>
      <Group label="Frame rate">
        {([24, 30, 60] as const).map((v) => <Chip key={v} v={v} cur={settings.fps} on={(x) => set("fps", x)}>{v} fps</Chip>)}
      </Group>
      <Group label="Quality">
        {(["standard", "high", "ultra"] as const).map((v) => <Chip key={v} v={v} cur={settings.quality} on={(x) => set("quality", x)}>{v}</Chip>)}
      </Group>
      <Group label="Transition">
        {(["cut", "fade", "crossfade", "slide", "dissolve"] as const).map((v) => <Chip key={v} v={v} cur={settings.transition} on={(x) => set("transition", x)}>{v}</Chip>)}
      </Group>
      <Group label="Transition duration">
        {[0.3, 0.6, 1.0, 1.5].map((v) => <Chip key={v} v={v} cur={settings.transitionDuration} on={(x) => set("transitionDuration", x)}>{v}s</Chip>)}
      </Group>
      <Group label="Burn-in subtitles">
        <Chip v={true as unknown as string} cur={settings.burnSubtitles as unknown as string} on={() => set("burnSubtitles", true)}>On</Chip>
        <Chip v={false as unknown as string} cur={settings.burnSubtitles as unknown as string} on={() => set("burnSubtitles", false)}>Off</Chip>
      </Group>
      <Group label="Subtitle position">
        {(["bottom", "middle", "top"] as const).map((v) => <Chip key={v} v={v} cur={settings.subtitlePosition ?? "bottom"} on={(x) => set("subtitlePosition", x)}>{v}</Chip>)}
      </Group>
    </div>
  );
}

function renumber(clips: SceneClip[]): SceneClip[] {
  // Recompute clipNumber within each scene, and cumulative timeline.
  const counts = new Map<number, number>();
  let cursor = 0;
  return clips.map((c) => {
    const next = (counts.get(c.sceneNumber) ?? 0) + 1;
    counts.set(c.sceneNumber, next);
    const dur = Math.max(0.5, c.durationSeconds - (c.trimStart ?? 0) - (c.trimEnd ?? 0));
    const updated: SceneClip = { ...c, clipNumber: next, startTime: cursor, endTime: cursor + dur };
    cursor += dur;
    return updated;
  });
}

function extractText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o.text ?? o.script ?? o.content ?? "");
  }
  return "";
}
function extractUrl(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
  }
  return undefined;
}
function parseImages(v: unknown): Array<{ id: string; url: string }> {
  if (!Array.isArray(v)) return [];
  return v.map((x, i) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { id: String(o.id ?? `img-${i + 1}`), url: String(o.url ?? "") };
  }).filter((x) => x.url);
}
function safeName(s: string): string {
  return s.replace(/[^a-z0-9-_ ]/gi, "_").trim() || "movie";
}
function formatTime(t: number): string {
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

// ------------- Render History (localStorage per browser) --------------
type RenderHistoryEntry = {
  projectId: string;
  name: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  provider: string;
  clips: number;
  failed: number;
  status: "success" | "partial" | "failed";
  avgClipSeconds: number;
};
const HISTORY_KEY = "storyspark:render-history";
function loadRenderHistory(): RenderHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as RenderHistoryEntry[]) : [];
  } catch { return []; }
}
function saveRenderHistory(entry: RenderHistoryEntry) {
  if (typeof window === "undefined") return;
  try {
    const list = loadRenderHistory();
    list.unshift(entry);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch { /* ignore */ }
}
function fmtSec(s: number): string {
  if (!isFinite(s) || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${ss}s` : `${ss}s`;
}
function fmtClock(ts: number): string {
  try { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}

// ------------- Progress Dashboard & Render Queue --------------
type QueueState = "pending" | "queued" | "rendering" | "completed" | "failed" | "retrying";
function clipState(c: SceneClip, idx: number, activeIdx: number | null, failed: Set<number>, retrying: boolean): QueueState {
  if (failed.has(idx)) return retrying ? "retrying" : "failed";
  if (c.url) return "completed";
  if (idx === activeIdx) return "rendering";
  if (activeIdx != null && idx < activeIdx) return "queued";
  return "pending";
}
const STATE_STYLES: Record<QueueState, string> = {
  pending: "bg-muted text-muted-foreground",
  queued: "bg-muted text-foreground",
  rendering: "bg-primary/15 text-primary",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-500",
  retrying: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function ProgressDashboard(props: {
  completed: number; total: number; overallPct: number;
  current: SceneClip | null; provider: string; avgClipSec: number;
  etaSec: number; elapsedSec: number; renderStartAt: number | null;
}) {
  const { completed, total, overallPct, current, provider, avgClipSec, etaSec, elapsedSec, renderStartAt } = props;
  const finishAt = renderStartAt ? renderStartAt + (elapsedSec + etaSec) * 1000 : 0;
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Rendering movie</p>
      </div>
      <Progress value={overallPct} className="h-3" />
      <p className="mt-1 text-[11px] text-muted-foreground">{overallPct}% · {completed} / {total} clips</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current clip" value={current ? `Scene ${current.sceneNumber} · Part ${current.clipNumber}` : "—"} />
        <Stat label="Status" value={current ? "Rendering…" : total === completed ? "Finalizing" : "Queued"} />
        <Stat label="Provider" value={provider} />
        <Stat label="Avg clip time" value={fmtSec(avgClipSec)} />
        <Stat label="Elapsed" value={fmtSec(elapsedSec)} />
        <Stat label="Est. remaining" value={fmtSec(etaSec)} />
        <Stat label="Est. finish" value={finishAt ? fmtClock(finishAt) : "—"} />
        <Stat label="Completed" value={`${completed} / ${total}`} />
      </div>
    </Card>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function RenderQueuePanel(props: {
  clips: SceneClip[]; activeIdx: number | null; failed: Set<number>; retryingAny: boolean;
  onRetry: (i: number) => void; onSkip: (i: number) => void; onPreview: (c: SceneClip) => void;
}) {
  const { clips, activeIdx, failed, retryingAny, onRetry, onSkip, onPreview } = props;
  if (!clips.length) return null;
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Render queue</p>
        <p className="text-[11px] text-muted-foreground">{clips.length} clip{clips.length === 1 ? "" : "s"}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {clips.map((c, i) => {
          const st = clipState(c, i, activeIdx, failed, retryingAny);
          const progressPct = st === "completed" ? 100 : st === "rendering" ? 55 : st === "retrying" ? 35 : 0;
          return (
            <div key={`q-${c.sceneNumber}-${c.clipNumber}-${i}`} className="rounded-2xl border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {st === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : st === "failed" ? <XCircle className="h-4 w-4 text-red-500" />
                    : st === "rendering" || st === "retrying" ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    : <Clock className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold">Scene {c.sceneNumber} · Clip {c.clipNumber}</span>
                </div>
                <Badge className={`rounded-full text-[10px] uppercase ${STATE_STYLES[st]}`}>{st}</Badge>
              </div>
              <Progress value={progressPct} className="h-1.5" />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                <span>{c.durationSeconds.toFixed(1)}s · {c.provider}</span>
                <span>{st === "completed" ? `done · ${formatTime(c.endTime)}` : "—"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {st === "completed" && (
                  <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => onPreview(c)}>
                    <Play className="mr-1 h-3 w-3" /> Preview
                  </Button>
                )}
                {st === "failed" && (
                  <>
                    <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => onRetry(i)}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Retry
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => onSkip(i)}>
                      <SkipForward className="mr-1 h-3 w-3" /> Skip
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RenderHistoryPanel() {
  const [items, setItems] = useState<RenderHistoryEntry[]>([]);
  useEffect(() => { setItems(loadRenderHistory()); }, []);
  if (!items.length) return null;
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Render history</p>
      <div className="divide-y divide-border">
        {items.slice(0, 8).map((it, i) => (
          <div key={`h-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold">{it.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(it.startTime).toLocaleString()} · {it.clips} clips · avg {fmtSec(it.avgClipSeconds)} · {it.provider}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{fmtSec(Math.round(it.durationMs / 1000))}</span>
              <Badge className={`rounded-full text-[10px] uppercase ${
                it.status === "success" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : it.status === "partial" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-red-500/15 text-red-500"
              }`}>{it.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

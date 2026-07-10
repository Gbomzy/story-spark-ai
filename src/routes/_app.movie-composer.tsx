import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Film, Download, Loader2, ArrowUp, ArrowDown, Trash2, Copy, RefreshCw, Scissors, Play, Wand2, Package, Music, Type,
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
    burnSubtitles: true,
    subtitleText: extractText(project.voice) || "",
    subtitlePosition: "bottom",
  });
  const [progress, setProgress] = useState<{ stage: string; percent: number; label?: string } | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const [renderedBlob, setRenderedBlob] = useState<Blob | null>(null);
  const [renderedExt, setRenderedExt] = useState<"webm" | "mp4">("webm");
  const [previewClip, setPreviewClip] = useState<SceneClip | null>(null);
  const renderStart = useRef<number>(0);
  const [renderMs, setRenderMs] = useState<number>(0);

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
          },
        },
      }),
    onSuccess: () => { toast.success("Timeline saved."); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message || "Save failed."),
  });

  const pipelineMut = useMutation({
    mutationFn: () => runPipeline({ data: { projectId: project.id, chainScenes: true } }),
    onSuccess: () => { toast.success("Pipeline complete."); qc.invalidateQueries({ queryKey: ["projects"] }); },
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

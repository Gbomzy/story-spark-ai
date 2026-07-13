import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Music, Sparkles, Copy, Download, Wand2, Play, Pause, Repeat, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { listProjects, updateProject } from "@/lib/projects";
import { analyzeStoryMusic } from "@/lib/storyMusicEngine.functions";
import {
  BGM_MOODS,
  SFX_KINDS,
  MUSIC_MODES,
  parseSongsField,
  parseAudioStudio,
  serializeAudioStudio,
  serializeSongsField,
  formatSongText,
  newSfxItem,
  DEFAULT_DUCKING,
  type BgmMood,
  type SfxKind,
  type MusicMode,
  type SongPosition,
  type StoryMusicPlan,
  type AudioStudioState,
  type AudioStudioScene,
  type SfxItem,
} from "@/lib/storyMusic";
import { AudioPreview, type PreviewState } from "@/lib/audioPreview";

export const Route = createFileRoute("/_app/songs")({
  head: () => ({
    meta: [
      { title: "Story Music Engine — StorySpark AI" },
      { name: "description", content: "Analyze a story and design an intelligent music plan: scene-by-scene background music, a lesson-reinforcing song, and mixing controls for the Movie Composer." },
    ],
  }),
  component: SongsPage,
});

function SongsPage() {
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Story Music Engine"
        description="Analyze the story, decide whether a song is needed, and design scene-level background music that mixes under narration."
      />
      {!project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project and generate a story first.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow">
            <Link to="/story-generator">Start a story</Link>
          </Button>
        </Card>
      ) : !project.story ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">This project has no story yet. Generate one before running the Music Engine.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow">
            <Link to="/story-generator">Open story generator</Link>
          </Button>
        </Card>
      ) : (
        <EngineBody project={project} />
      )}
    </div>
  );
}

type ProjectLike = {
  id: string;
  name: string;
  story: string | null;
  age_group: string | null;
  language: string | null;
  topic: string | null;
  songs: string | null;
  background_music: unknown;
};

function EngineBody({ project }: { project: ProjectLike }) {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeStoryMusic);

  const stored = parseSongsField(project.songs);
  const initialPlan = stored.kind === "plan" ? stored.plan : null;
  const legacyLyrics = stored.kind === "legacy" ? stored.lyrics : null;

  const [mode, setMode] = useState<MusicMode>(initialPlan?.mode ?? "story_only");
  const [customPosition, setCustomPosition] = useState<SongPosition>("ending");
  const [customMood, setCustomMood] = useState<BgmMood | "">("");
  const [plan, setPlan] = useState<StoryMusicPlan | null>(initialPlan);

  const [studio, setStudio] = useState<AudioStudioState>(() =>
    parseAudioStudio(project.background_music, initialPlan?.scenes),
  );

  const mut = useMutation({
    mutationFn: async () => {
      if (!project.story) throw new Error("No story to analyze.");
      const brief = `Project: ${project.name}\nTopic: ${project.topic ?? ""}`;
      const r = await analyze({
        data: {
          prompt: brief,
          story: project.story,
          ageGroup: project.age_group ?? undefined,
          language: project.language ?? undefined,
          mode,
          customPosition: mode === "custom" ? customPosition : undefined,
          customMoodOverride: mode === "custom" && customMood ? (customMood as BgmMood) : undefined,
        },
      });
      const nextPlan: StoryMusicPlan = r.plan;
      // Re-derive studio state from the fresh plan (preserving any URLs the
      // user pasted for scenes that still exist).
      const merged = parseAudioStudio(
        serializeAudioStudio({ ...studio, scenes: mergeScenes(studio.scenes, nextPlan.scenes) }),
        nextPlan.scenes,
      );
      if (nextPlan.endingCredits) {
        merged.endingCredits = {
          enabled: nextPlan.endingCredits.enabled,
          fadeOutSeconds: nextPlan.endingCredits.fadeOutSeconds,
          text: nextPlan.endingCredits.text,
          trackUrl: merged.endingCredits.trackUrl,
        };
      }
      await updateProject(project.id, {
        songs: serializeSongsField(nextPlan),
        background_music: {
          ...serializeAudioStudio(merged),
          backgroundStyle: nextPlan.recommendation.backgroundStyle,
        } as unknown as import("@/integrations/supabase/types").Json,
      });
      setPlan(nextPlan);
      setStudio(merged);
    },
    onSuccess: () => {
      toast.success("Music plan generated");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      toast.error(msg);
    },
  });

  const saveScenesMut = useMutation({
    mutationFn: async () => {
      await updateProject(project.id, {
        background_music: ({
          ...serializeAudioStudio(studio),
        }) as unknown as import("@/integrations/supabase/types").Json,
      });
    },
    onSuccess: () => {
      toast.success("Audio Studio saved");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed."),
  });

  function patchScene(sceneNumber: number, patch: Partial<AudioStudioScene>) {
    setStudio((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.sceneNumber === sceneNumber ? { ...s, ...patch } : s)),
    }));
  }
  function patchStudio(patch: Partial<AudioStudioState>) {
    setStudio((prev) => ({ ...prev, ...patch }));
  }

  function copySong() {
    if (!plan?.song) return;
    navigator.clipboard.writeText(formatSongText(plan.song));
    toast.success("Song copied");
  }
  function downloadSong() {
    if (!plan?.song) return;
    const blob = new Blob([formatSongText(plan.song)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\s+/g, "-").toLowerCase()}-song.txt`;
    a.click();
  }

  return (
    <>
      {/* Mode selector */}
      <Card className="glass rounded-3xl p-6 shadow-soft">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Story music mode</p>
          <h3 className="text-lg font-bold">Choose what music this story needs</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MUSIC_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-2xl border p-4 text-left transition ${mode === m.id ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card/60 hover:border-primary/40"}`}
            >
              <p className="text-sm font-semibold">{m.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{m.description}</p>
            </button>
          ))}
        </div>

        {mode === "custom" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Song position</p>
              <div className="flex flex-wrap gap-1">
                {(["none", "intro", "middle", "ending", "multiple"] as const).map((p) => (
                  <Button key={p} size="sm" variant={customPosition === p ? "default" : "outline"} className="rounded-lg" onClick={() => setCustomPosition(p)}>{p}</Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Mood override (optional)</p>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={customMood === "" ? "default" : "outline"} className="rounded-lg" onClick={() => setCustomMood("")}>auto</Button>
                {BGM_MOODS.map((m) => (
                  <Button key={m} size="sm" variant={customMood === m ? "default" : "outline"} className="rounded-lg" onClick={() => setCustomMood(m)}>{m}</Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            The engine reads the story, extracts theme + lesson + emotional arc, then recommends background music per scene and decides if a song helps.
          </p>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="rounded-xl gradient-primary text-white shadow-glow">
            {mut.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analyzing…</> : <><Sparkles className="mr-1.5 h-4 w-4" /> {plan ? "Re-analyze story" : "Analyze story"}</>}
          </Button>
        </div>

        {legacyLyrics && !plan ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            Legacy lyrics from the story generator are stored on this project. Run the analyzer to upgrade to a full music plan.
          </div>
        ) : null}
      </Card>

      {plan ? (
        <>
          {/* Analysis */}
          <Card className="glass rounded-3xl p-6 shadow-soft">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Story analysis</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnalysisStat label="Theme" value={plan.analysis.theme} />
              <AnalysisStat label="Mood" value={plan.analysis.mood} />
              <AnalysisStat label="Target age" value={plan.analysis.targetAge} />
              <AnalysisStat label="Lesson" value={plan.analysis.lesson} span2 />
              <AnalysisStat label="Emotional arc" value={plan.analysis.emotionalArc} span2 />
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recommended background style</p>
                <p className="mt-0.5 text-sm font-semibold">{plan.recommendation.backgroundStyle || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Song recommendation</p>
                <p className="mt-0.5 text-sm font-semibold">
                  {plan.recommendation.songNeeded ? (
                    <>Yes · <span className="text-primary">{plan.recommendation.songPosition}</span></>
                  ) : (
                    "Not recommended"
                  )}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{plan.recommendation.reasoning}</p>
              </div>
            </div>
          </Card>

          {/* Song */}
          {plan.song ? (
            <Card className="glass rounded-3xl p-6 shadow-soft">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Original song · {plan.song.position}</p>
                  <h3 className="text-lg font-bold">{plan.song.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-primary/15 text-primary">{Math.round(plan.song.estimatedDurationSeconds)}s</Badge>
                  <Badge className="rounded-full bg-muted text-muted-foreground">Singability: {plan.song.singability}</Badge>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl bg-card/60 p-4 text-sm leading-relaxed">
                {plan.song.verses.map((v, i) => (
                  <div key={i}>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Verse {i + 1}</p>
                    <p className="whitespace-pre-wrap">{v}</p>
                  </div>
                ))}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Chorus</p>
                  <p className="whitespace-pre-wrap">{plan.song.chorus}</p>
                </div>
                {plan.song.bridge ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Bridge</p>
                    <p className="whitespace-pre-wrap">{plan.song.bridge}</p>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground"><strong>Reinforces lesson:</strong> {plan.song.reinforcesLesson}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-xl" onClick={copySong}><Copy className="mr-1.5 h-4 w-4" /> Copy</Button>
                <Button variant="outline" className="rounded-xl" onClick={downloadSong}><Download className="mr-1.5 h-4 w-4" /> Download TXT</Button>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
                <Music className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Music synthesis is currently unavailable under the configured Qwen Cloud capabilities. Lyrics remain available for export.</span>
              </div>
            </Card>
          ) : null}

          {/* Scene BGM */}
          <Card className="glass rounded-3xl p-6 shadow-soft">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Scene audio</p>
                <h3 className="text-lg font-bold">Music, sound effects &amp; volumes per scene</h3>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => saveScenesMut.mutate()} disabled={saveScenesMut.isPending}>
                {saveScenesMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />} Save
              </Button>
            </div>
            <div className="space-y-3">
              {studio.scenes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No scenes in the plan.</p>
              ) : studio.scenes.map((s) => (
                <SceneRow
                  key={s.sceneNumber}
                  scene={s}
                  onPatch={(patch) => patchScene(s.sceneNumber, patch)}
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Music volume sits under narration. Automatic ducking (below) lowers it further while narration is speaking.
            </p>
          </Card>

          <DuckingCard ducking={studio.ducking} onChange={(d) => patchStudio({ ducking: d })} />
          <EndingCreditsCard ec={studio.endingCredits} onChange={(ec) => patchStudio({ endingCredits: ec })} />
        </>
      ) : null}
    </>
  );
}

function mergeScenes(current: AudioStudioScene[], planScenes: StoryMusicPlan["scenes"]): AudioStudioScene[] {
  return planScenes.map((ps) => {
    const cur = current.find((c) => c.sceneNumber === ps.sceneNumber);
    return {
      sceneNumber: ps.sceneNumber,
      title: ps.title,
      bgmMood: cur?.bgmMood ?? ps.bgmMood,
      bgmTrackUrl: cur?.bgmTrackUrl,
      musicVolume: cur?.musicVolume ?? ps.volume,
      narrationVolume: cur?.narrationVolume ?? ps.narrationVolume ?? 1,
      sfx: cur?.sfx ?? (ps.sfx ?? []).map((x) => ({ id: Math.random().toString(36).slice(2, 10), kind: x.kind, volume: x.volume })),
    };
  });
}

function SceneRow({ scene, onPatch }: { scene: AudioStudioScene; onPatch: (p: Partial<AudioStudioScene>) => void }) {
  const previewRef = useRef<AudioPreview | null>(null);
  const [state, setState] = useState<PreviewState>("idle");
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    const p = new AudioPreview(scene.bgmTrackUrl);
    previewRef.current = p;
    const unsub = p.subscribe(setState);
    return () => { unsub(); p.dispose(); previewRef.current = null; };
    // scene id-only dependency: recreate on scene number
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.sceneNumber]);

  useEffect(() => { previewRef.current?.setUrl(scene.bgmTrackUrl); }, [scene.bgmTrackUrl]);
  useEffect(() => { previewRef.current?.setLoop(loop); }, [loop]);

  function downloadTrack() {
    if (!scene.bgmTrackUrl) return;
    const a = document.createElement("a");
    a.href = scene.bgmTrackUrl;
    a.download = `scene-${scene.sceneNumber}-music`;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
  }

  function addSfx(kind: SfxKind) {
    onPatch({ sfx: [...scene.sfx, newSfxItem(kind)] });
  }
  function patchSfx(id: string, patch: Partial<SfxItem>) {
    onPatch({ sfx: scene.sfx.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function removeSfx(id: string) {
    onPatch({ sfx: scene.sfx.filter((s) => s.id !== id) });
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-primary/15 text-[10px] text-primary">Scene {scene.sceneNumber}</Badge>
        <p className="text-sm font-semibold">{scene.title ?? ""}</p>
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Mood</p>
        <div className="flex flex-wrap gap-1">
          {BGM_MOODS.map((m) => (
            <Button key={m} size="sm" variant={scene.bgmMood === m ? "default" : "outline"} className="rounded-lg text-[11px]" onClick={() => onPatch({ bgmMood: m })}>{m}</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr,auto]">
        <Input
          value={scene.bgmTrackUrl ?? ""}
          onChange={(e) => onPatch({ bgmTrackUrl: e.target.value || undefined })}
          placeholder="Background music URL (mp3)…"
          className="h-8 text-xs"
        />
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="rounded-lg" disabled={!scene.bgmTrackUrl} onClick={() => previewRef.current?.toggle()}>
            {state === "playing" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant={loop ? "default" : "outline"} className="rounded-lg" onClick={() => setLoop((v) => !v)} title="Loop">
            <Repeat className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="rounded-lg" disabled={!scene.bgmTrackUrl} onClick={downloadTrack} title="Download">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <VolumeSlider label="Music volume" value={scene.musicVolume} onChange={(v) => onPatch({ musicVolume: v })} />
        <VolumeSlider label="Narration volume" value={scene.narrationVolume} onChange={(v) => onPatch({ narrationVolume: v })} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Sound effects</p>
        </div>
        <div className="space-y-2">
          {scene.sfx.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
              <Badge className="rounded-full bg-muted text-[10px]">{s.kind}</Badge>
              <Input
                value={s.url ?? ""}
                onChange={(e) => patchSfx(s.id, { url: e.target.value || undefined })}
                placeholder="SFX URL (optional)"
                className="h-7 flex-1 text-xs"
              />
              <div className="flex items-center gap-1 w-40">
                <span className="text-[10px] text-muted-foreground">Vol</span>
                <input type="range" min={0} max={100} value={Math.round(s.volume * 100)} onChange={(e) => patchSfx(s.id, { volume: Number(e.target.value) / 100 })} className="flex-1" />
                <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(s.volume * 100)}%</span>
              </div>
              <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => removeSfx(s.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {SFX_KINDS.map((k) => (
            <Button key={k} size="sm" variant="outline" className="rounded-lg text-[11px]" onClick={() => addSfx(k)}>
              <Plus className="mr-1 h-3 w-3" /> {k}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">{label} · {Math.round(value * 100)}%</p>
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} className="w-full" />
    </div>
  );
}

function DuckingCard({ ducking, onChange }: { ducking: AudioStudioState["ducking"]; onChange: (d: AudioStudioState["ducking"]) => void }) {
  return (
    <Card className="glass rounded-3xl p-6 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Automatic ducking</p>
          <h3 className="text-lg font-bold">Lower music while narration speaks</h3>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={ducking.enabled ? "default" : "outline"} className="rounded-lg" onClick={() => onChange({ ...ducking, enabled: true })}>On</Button>
          <Button size="sm" variant={!ducking.enabled ? "default" : "outline"} className="rounded-lg" onClick={() => onChange({ ...ducking, enabled: false })}>Off</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <VolumeSlider label="Ducked level" value={ducking.duckedLevel} onChange={(v) => onChange({ ...ducking, duckedLevel: v })} />
        <VolumeSlider label="Speech threshold" value={ducking.threshold} onChange={(v) => onChange({ ...ducking, threshold: v })} />
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Attack · {ducking.attackMs}ms</p>
          <input type="range" min={20} max={800} value={ducking.attackMs} onChange={(e) => onChange({ ...ducking, attackMs: Number(e.target.value) })} className="w-full" />
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Release · {ducking.releaseMs}ms</p>
          <input type="range" min={50} max={1500} value={ducking.releaseMs} onChange={(e) => onChange({ ...ducking, releaseMs: Number(e.target.value) })} className="w-full" />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        The Movie Composer analyses narration RMS in real time and ramps background music down while the narrator is speaking, then back up between segments.
      </p>
    </Card>
  );
}

function EndingCreditsCard({ ec, onChange }: { ec: AudioStudioState["endingCredits"]; onChange: (v: AudioStudioState["endingCredits"]) => void }) {
  return (
    <Card className="glass rounded-3xl p-6 shadow-soft">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Ending credits</p>
          <h3 className="text-lg font-bold">Optional closing music &amp; fade-out</h3>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={ec.enabled ? "default" : "outline"} className="rounded-lg" onClick={() => onChange({ ...ec, enabled: true })}>Enable</Button>
          <Button size="sm" variant={!ec.enabled ? "default" : "outline"} className="rounded-lg" onClick={() => onChange({ ...ec, enabled: false })}>Disable</Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Credits track URL</p>
          <Input value={ec.trackUrl ?? ""} onChange={(e) => onChange({ ...ec, trackUrl: e.target.value || undefined })} placeholder="https://…/credits.mp3" className="h-8 text-xs" />
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Fade-out · {ec.fadeOutSeconds.toFixed(1)}s</p>
          <input type="range" min={1} max={10} step={0.5} value={ec.fadeOutSeconds} onChange={(e) => onChange({ ...ec, fadeOutSeconds: Number(e.target.value) })} className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Credits text (optional)</p>
          <Input value={ec.text ?? ""} onChange={(e) => onChange({ ...ec, text: e.target.value || undefined })} placeholder="Written &amp; produced by…" className="h-8 text-xs" />
        </div>
      </div>
    </Card>
  );
}

function AnalysisStat({ label, value, span2 }: { label: string; value: string; span2?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-card/60 p-3 ${span2 ? "sm:col-span-2 lg:col-span-3" : ""}`}>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}
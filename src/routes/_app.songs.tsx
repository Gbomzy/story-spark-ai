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
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Scene background music</p>
                <h3 className="text-lg font-bold">Mood + duck volume per scene</h3>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => saveScenesMut.mutate()} disabled={saveScenesMut.isPending}>
                {saveScenesMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />} Save
              </Button>
            </div>
            <div className="space-y-2">
              {sceneOverrides.length === 0 ? (
                <p className="text-xs text-muted-foreground">No scenes in the plan.</p>
              ) : sceneOverrides.map((s) => {
                const planScene = plan.scenes.find((p) => p.sceneNumber === s.sceneNumber);
                return (
                  <div key={s.sceneNumber} className="grid gap-2 rounded-2xl border border-border bg-card/60 p-3 md:grid-cols-[auto,1fr,auto]">
                    <div className="md:w-40">
                      <Badge className="rounded-full bg-primary/15 text-[10px] text-primary">Scene {s.sceneNumber}</Badge>
                      <p className="mt-1 text-[11px] font-medium">{planScene?.title ?? ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {BGM_MOODS.map((m) => (
                        <Button key={m} size="sm" variant={s.bgmMood === m ? "default" : "outline"} className="rounded-lg text-[11px]" onClick={() => updateSceneMood(s.sceneNumber, m)}>{m}</Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 md:w-48">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Vol</span>
                      <input
                        type="range" min={0} max={100} step={1}
                        value={Math.round(s.volume * 100)}
                        onChange={(e) => updateSceneVolume(s.sceneNumber, Number(e.target.value) / 100)}
                        className="w-full"
                      />
                      <span className="text-[10px] text-muted-foreground w-8 text-right">{Math.round(s.volume * 100)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Volume controls how loud background music sits under narration in the Movie Composer. Lower values (10-25%) work best for spoken scenes.
            </p>
          </Card>
        </>
      ) : null}
    </>
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
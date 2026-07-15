import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { parseBible } from "@/lib/storyBible";
import {
  buildDirectorReport,
  EMOTIONS,
  type DirectorReport,
  type DirectorSceneInput,
} from "@/lib/directorV2";
import { Clapperboard, Film, Sparkles, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_app/director")({
  head: () => ({
    meta: [
      { title: "AI Director — StorySpark AI" },
      {
        name: "description",
        content: "AI Director Report: emotion, camera, lighting, motion, music, and quality across every scene.",
      },
    ],
  }),
  component: DirectorPage,
});

function DirectorPage() {
  const [projectId, setProjectId] = useState("");
  const [report, setReport] = useState<DirectorReport | null>(null);

  const analyze = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,story,voice,images,storyboard,story_bible")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Project not found");
      const bible = parseBible(data.story_bible);
      const scenes: DirectorSceneInput[] = parseScenes(data.images, data.storyboard);
      if (scenes.length === 0) throw new Error("No storyboard scenes to analyze yet.");
      const withDirection = scenes.map((s) => ({ ...s, direction: bible?.direction?.[s.id] }));
      return buildDirectorReport(withDirection);
    },
    onSuccess: (r) => setReport(r),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <Clapperboard className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">AI Director</h1>
          <p className="text-sm text-muted-foreground">
            Emotion, camera, lighting, motion, music, transitions, and quality grades — all in one report.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Analyze a project
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            placeholder="Project ID (uuid)"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
          <Button
            onClick={() => projectId && analyze.mutate(projectId)}
            disabled={!projectId || analyze.isPending}
          >
            {analyze.isPending ? "Directing…" : "Run Director"}
          </Button>
        </CardContent>
      </Card>

      {analyze.error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            {(analyze.error as Error).message}
          </CardContent>
        </Card>
      )}

      {report && <ReportView report={report} />}
    </div>
  );
}

function ReportView({ report }: { report: DirectorReport }) {
  const runtime = useMemo(() => {
    const m = Math.floor(report.runtimeSeconds / 60);
    const s = report.runtimeSeconds % 60;
    return `${m}m ${s}s`;
  }, [report.runtimeSeconds]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Director's overall report
            </span>
            <Badge variant="secondary" className="text-lg">
              {report.overallMovieScore}/100 · {report.quality.grade}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{report.summary}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Runtime" value={runtime} />
            <Stat label="Engagement" value={`${report.audienceEngagement}/100`} />
            <Stat label="Scenes" value={String(report.scenes.length)} />
            <Stat label="Grade" value={report.quality.grade} />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <GradeRow label="Story" value={report.quality.storyQuality} />
            <GradeRow label="Animation" value={report.quality.animationQuality} />
            <GradeRow label="Visual Variety" value={report.quality.visualVariety} />
            <GradeRow label="Camera Variety" value={report.quality.cameraVariety} />
            <GradeRow label="Dialogue" value={report.quality.dialogueQuality} />
            <GradeRow label="Emotion" value={report.quality.emotionQuality} />
            <GradeRow label="Educational" value={report.quality.educationalValue} />
            <GradeRow label="Entertainment" value={report.quality.entertainmentValue} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Emotion graph</CardTitle></CardHeader>
        <CardContent>
          <EmotionGraph report={report} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pace & importance</CardTitle></CardHeader>
        <CardContent>
          <PaceGraph report={report} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Film className="h-4 w-4" /> Scene-by-scene direction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.scenes.map((s) => (
            <div key={s.sceneId} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-medium">
                  <span>Scene {s.sceneNumber}</span>
                  <Badge variant="outline">{s.role}</Badge>
                  <Badge variant="secondary">Importance {s.importance}/10</Badge>
                  <Badge>{s.dominantEmotion}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.targetDurationSeconds}s · {s.pacing} · engagement {s.engagementScore}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs md:grid-cols-3">
                <span>Shot: {s.shot.cameraShot} ({s.shot.cameraLens})</span>
                <span>Camera: {s.shot.cameraMovement}</span>
                <span>Face: {s.facialExpression}</span>
                <span>Lighting: {s.lighting}</span>
                <span>Color: {s.colorPhase}</span>
                <span>Transition: {s.transition}</span>
                <span>Music: {s.music.mood} · {s.music.tempoBpm}bpm</span>
                <span className="col-span-2">Motion: {s.motion.join(", ")}</span>
              </div>
              {s.notes.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {s.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function GradeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}/100</span>
      </div>
      <Progress value={value} className="mt-2" />
    </div>
  );
}

function EmotionGraph({ report }: { report: DirectorReport }) {
  const max = 10;
  return (
    <div className="space-y-2">
      {EMOTIONS.map((e) => (
        <div key={e} className="flex items-center gap-2 text-xs">
          <span className="w-24 capitalize text-muted-foreground">{e}</span>
          <div className="flex flex-1 gap-1">
            {report.emotionGraph.map((g) => {
              const v = g.scores[e];
              const h = Math.max(2, Math.round((v / max) * 28));
              return (
                <div
                  key={g.sceneNumber}
                  className="flex-1 rounded-sm bg-primary/70"
                  style={{ height: `${h}px`, opacity: v === 0 ? 0.15 : 0.4 + (v / max) * 0.6 }}
                  title={`Scene ${g.sceneNumber}: ${v}`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaceGraph({ report }: { report: DirectorReport }) {
  return (
    <div className="flex items-end gap-1 h-32">
      {report.paceGraph.map((p) => {
        const h = Math.max(6, p.importance * 10);
        return (
          <div key={p.sceneNumber} className="flex-1 flex flex-col items-center gap-1" title={`Scene ${p.sceneNumber}: importance ${p.importance}, ${p.duration}s`}>
            <div className="w-full rounded-t bg-primary" style={{ height: `${h}px`, opacity: 0.4 + (p.energy / 200) }} />
            <span className="text-[10px] text-muted-foreground">{p.sceneNumber}</span>
          </div>
        );
      })}
    </div>
  );
}

function parseScenes(images: unknown, storyboard: unknown): DirectorSceneInput[] {
  const fromImages = tryParseImages(images);
  if (fromImages.length > 0) return fromImages;
  const text = typeof storyboard === "string" ? storyboard : "";
  if (!text.trim()) return [];
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.slice(0, 40).map((block, i) => {
    const firstLine = block.split("\n")[0].trim();
    const rest = block.split("\n").slice(1).join("\n").trim();
    const title = firstLine.replace(/^#+\s*/, "").slice(0, 120) || `Scene ${i + 1}`;
    return { id: `scene-${i + 1}`, prompt: `${title}. ${rest || firstLine}`.slice(0, 1200) };
  });
}

function tryParseImages(images: unknown): DirectorSceneInput[] {
  if (!images) return [];
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, i) => {
        const o = entry as { id?: string; prompt?: string; title?: string; description?: string };
        const id = o.id ?? `scene-${i + 1}`;
        const prompt = o.prompt ?? o.description ?? o.title ?? "";
        if (!prompt) return null;
        return { id, prompt } satisfies DirectorSceneInput;
      })
      .filter((v): v is DirectorSceneInput => v !== null);
  } catch {
    return [];
  }
}
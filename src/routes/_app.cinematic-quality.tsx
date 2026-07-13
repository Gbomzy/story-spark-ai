import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { parseBible } from "@/lib/storyBible";
import { buildShotPlan, type CameraShot, type CinematicShotPlan } from "@/lib/cinematicDirector";
import { validateCinematicQuality, type CinematicQualityReport } from "@/lib/cinematicQuality";
import { CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/cinematic-quality")({
  head: () => ({
    meta: [
      { title: "Cinematic Quality — StorySpark AI" },
      { name: "description", content: "Cinematic Quality Score for your AI-directed movie." },
    ],
  }),
  component: CinematicQualityPage,
});

function CinematicQualityPage() {
  const [projectId, setProjectId] = useState("");
  const [report, setReport] = useState<CinematicQualityReport | null>(null);
  const [shotPlans, setShotPlans] = useState<CinematicShotPlan[]>([]);

  const validate = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,story,voice,images,story_bible,video_file")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Project not found");

      const bible = parseBible(data.story_bible);
      const scenes = parseScenes(data.images);
      // Build shot plans from stored direction or fresh heuristics
      const plans: CinematicShotPlan[] = [];
      let prev: CameraShot | undefined;
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        const plan = buildShotPlan({
          sceneId: s.id,
          sceneNumber: i + 1,
          total: scenes.length,
          text: s.prompt,
          direction: bible?.direction?.[s.id],
          prevShot: prev,
        });
        prev = plan.cameraShot;
        plans.push(plan);
      }

      const manifest = (data.video_file ?? null) as {
        clips?: Array<{ url?: string; prompt?: string; durationSeconds?: number }>;
      } | null;

      const script = typeof data.voice === "string" ? data.voice : (data.voice as { text?: string } | null)?.text ?? "";
      const narrationSegments = script.split(/[.!?]/).filter((s) => s.trim().length > 0).length;

      const report = validateCinematicQuality({
        bible,
        shotPlans: plans,
        clips: manifest?.clips ?? [],
        narrationSegments,
        musicUrl: null,
        transitions: plans.map((p) => p.transition),
      });
      return { report, plans };
    },
    onSuccess: (r) => { setReport(r.report); setShotPlans(r.plans); },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <Sparkles className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Cinematic Quality</h1>
          <p className="text-sm text-muted-foreground">
            Score your movie across character, world, camera, motion, rhythm, and continuity.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Analyze project</CardTitle></CardHeader>
        <CardContent className="flex gap-3">
          <Input
            placeholder="Project ID (uuid)"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
          <Button
            onClick={() => projectId && validate.mutate(projectId)}
            disabled={!projectId || validate.isPending}
          >
            {validate.isPending ? "Analyzing…" : "Run validation"}
          </Button>
        </CardContent>
      </Card>

      {validate.error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            {(validate.error as Error).message}
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Overall Score</span>
                <Badge variant="secondary" className="text-lg">{report.score} / 100 · {report.grade}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={report.score} />
              <div className="grid gap-2 md:grid-cols-2">
                {report.checks.map((c) => (
                  <div key={c.key} className="flex items-start gap-2 rounded-lg border p-3">
                    {c.passed
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                      : <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{c.label}</span>
                        <span className="text-xs text-muted-foreground">{Math.round(c.score)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {shotPlans.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Director's shot plan</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {shotPlans.map((p) => (
                  <div key={p.sceneId} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between font-medium">
                      <span>Scene {p.sceneNumber} · {p.role}</span>
                      <Badge variant="outline">{p.cameraShot} · {p.cameraLens}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.sceneGoal}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs md:grid-cols-3">
                      <span>Move: {p.cameraMovement}</span>
                      <span>Light: {p.lightingStyle}</span>
                      <span>Palette: {p.colorPalette}</span>
                      <span>Emotion: {p.emotionalIntent}</span>
                      <span>Transition: {p.transition}</span>
                      <span>Motion: {p.motionInstructions.slice(0, 3).join(", ")}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function parseScenes(images: unknown): Array<{ id: string; prompt: string }> {
  if (!images) return [];
  try {
    const parsed = typeof images === "string" ? JSON.parse(images) : images;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: unknown, i: number) => {
        const o = (s ?? {}) as Record<string, unknown>;
        const prompt = String(o.prompt ?? o.description ?? o.text ?? "").trim();
        const id = String(o.id ?? `scene-${i + 1}`);
        return prompt ? { id, prompt } : null;
      })
      .filter(Boolean) as Array<{ id: string; prompt: string }>;
  } catch { return []; }
}
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Sparkles, Loader2, Film, ArrowRight, Save, Check } from "lucide-react";
import { toast } from "sonner";
import {
  generateStory,
  generateCharacters,
  generateStoryboard,
  generateMediaPack,
} from "@/lib/qwen.functions";
import { generateScenePlan } from "@/lib/scenePlan.functions";
import { scenePlanToStoryboard, scenePlanToVoiceScript, scenePlanToImagesJson } from "@/lib/scenePlan";
import { OutputWorkspace } from "@/components/output-workspace";
import { createProject, updateProject } from "@/lib/projects";
import { formatDbError } from "@/lib/dbError";

export const Route = createFileRoute("/_app/story-generator")({
  head: () => ({ meta: [{ title: "Story Generator — StorySpark AI" }] }),
  validateSearch: (s: Record<string, unknown>): { prompt?: string; category?: string } => ({
    ...(typeof s.prompt === "string" ? { prompt: s.prompt } : {}),
    ...(typeof s.category === "string" ? { category: s.category } : {}),
  }),
  component: StoryGeneratorPage,
});

function StoryGeneratorPage() {
  const search = useSearch({ from: "/_app/story-generator" });
  const [prompt, setPrompt] = useState(
    search.prompt ?? "A shy fox who wants to make friends at school.",
  );
  const category = search.category;
  const [story, setStory] = useState<string | null>(null);
  const [characters, setCharacters] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [songs, setSongs] = useState<string | null>(null);
  const [images, setImages] = useState<string | null>(null);
  const [seo, setSeo] = useState<string | null>(null);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [scenePlan, setScenePlan] = useState<Awaited<ReturnType<typeof generateScenePlan>>["plan"] | null>(null);
  const mutation = useMutation({
    mutationFn: async (p: string) => {
      setStory(null);
      setCharacters(null);
      setStoryboard(null);
      setVoice(null);
      setSongs(null);
      setImages(null);
      setSeo(null);
      setSavedProjectId(null);
      setScenePlan(null);
      const s = await generateStory({ data: { prompt: p, ...(category ? { category } : {}) } });
      setStory(s.story);
      // Generate the Scene Plan (single source of truth) FIRST so we can
      // derive storyboard, narration and image prompts from it. Characters
      // and songs/seo still run in parallel from the story.
      const [plan, c, pack] = await Promise.all([
        generateScenePlan({ data: { prompt: p, story: s.story, ...(category ? { category } : {}) } }),
        generateCharacters({ data: { prompt: p, story: s.story, ...(category ? { category } : {}) } }),
        generateMediaPack({ data: { prompt: p, story: s.story, ...(category ? { category } : {}) } }),
      ]);
      const derivedStoryboard = scenePlanToStoryboard(plan.plan);
      const derivedVoice = scenePlanToVoiceScript(plan.plan);
      const derivedImages = JSON.stringify(scenePlanToImagesJson(plan.plan), null, 2);
      return {
        story: s.story,
        characters: c.characters,
        storyboard: derivedStoryboard,
        voice: derivedVoice,
        songs: pack.songs,
        images: derivedImages,
        seo: pack.seo,
        scenePlan: plan.plan,
      };
    },
    onSuccess: (res) => {
      setStory(res.story);
      setCharacters(res.characters);
      setStoryboard(res.storyboard);
      setVoice(res.voice);
      setSongs(res.songs);
      setImages(res.images);
      setSeo(res.seo);
      setScenePlan(res.scenePlan);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to generate"),
  });
  function generate() {
    mutation.mutate(prompt);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!story) throw new Error("Generate a story first");
      const name = prompt.split("\n")[0].slice(0, 60) || "Untitled story";
      const payload: Record<string, unknown> = {
        name,
        story,
        characters: characters ?? "",
        storyboard: storyboard ?? "",
        voice: voice ?? "",
        songs: songs ?? "",
        images: images ?? "",
        seo: seo ?? "",
      };
      if (scenePlan) {
        payload.story_bible = {
          version: 1,
          scenePlan,
          updatedAt: new Date().toISOString(),
        };
      }
      try {
        if (savedProjectId) {
          await updateProject(savedProjectId, payload as never);
          return savedProjectId;
        }
        const p = await createProject(payload as never);
        return p.id as string;
      } catch (err) {
        throw new Error(formatDbError(err, "Save failed"));
      }
    },
    onSuccess: (id) => {
      setSavedProjectId(id);
      toast.success("Story saved to your projects.");
    },
    onError: (e: unknown) => toast.error(formatDbError(e, "Failed to save")),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Story Generator"
        description="Turn a one-liner into a structured, age-appropriate story."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass rounded-3xl p-6 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl gradient-primary text-white"><Wand2 className="h-4 w-4" /></div>
            <h3 className="font-semibold">Prompt</h3>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-40 rounded-2xl"
            placeholder="Describe the seed of the story…"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Friendship", "Kindness", "Curiosity", "Counting", "Colors"].map((t) => (
              <Badge key={t} variant="secondary" className="cursor-pointer rounded-full" onClick={() => setPrompt((p: string) => p + ` (theme: ${t})`)}>{t}</Badge>
            ))}
          </div>
          <Button onClick={generate} disabled={mutation.isPending} className="mt-4 w-full rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            {mutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Generate story</>
            )}
          </Button>
        </Card>

        <Card className="glass rounded-3xl p-6 shadow-soft">
          <h3 className="mb-3 font-semibold">Preview</h3>
          {story ? (
            <article className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{story}</article>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              Your generated story will appear here.
            </div>
          )}
        </Card>
      </div>

      <OutputWorkspace
        initialValues={{
          ...(story ? { story } : {}),
          ...(characters ? { characters } : {}),
          ...(storyboard ? { storyboard } : {}),
          ...(voice ? { voice } : {}),
          ...(songs ? { songs } : {}),
          ...(images ? { images } : {}),
          ...(seo ? { seo } : {}),
        }}
        status={
          mutation.isPending
            ? "generating"
            : story || characters || storyboard || voice || songs || images || seo
              ? "ready"
              : "awaiting"
        }
      />

      {story ? (
        <Card className="glass flex flex-col items-center justify-between gap-3 rounded-3xl p-5 shadow-soft sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl gradient-primary text-white">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Your story is ready</p>
              <p className="text-xs text-muted-foreground">
                {savedProjectId ? "Saved to your projects. Continue to Video Studio to render." : "Save the story to your projects, then continue to Video Studio."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              variant={savedProjectId ? "outline" : "default"}
              className={savedProjectId ? "rounded-xl" : "rounded-xl gradient-primary text-white shadow-glow"}
            >
              {saveMut.isPending ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</>
              ) : savedProjectId ? (
                <><Check className="mr-1.5 h-4 w-4" /> Saved · update</>
              ) : (
                <><Save className="mr-1.5 h-4 w-4" /> Save story</>
              )}
            </Button>
            <Button
              asChild
              disabled={!savedProjectId}
              className="rounded-xl gradient-primary text-white shadow-glow disabled:opacity-60"
            >
              {savedProjectId ? (
                <Link to="/video-studio" search={{ projectId: savedProjectId }}>
                  Generate the movie <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              ) : (
                <span>Generate the movie <ArrowRight className="ml-1.5 h-4 w-4" /></span>
              )}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

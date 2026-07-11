import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Sparkles, Loader2, Film, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  generateStory,
  generateCharacters,
  generateStoryboard,
  generateMediaPack,
} from "@/lib/qwen.functions";
import { OutputWorkspace } from "@/components/output-workspace";

export const Route = createFileRoute("/_app/story-generator")({
  head: () => ({ meta: [{ title: "Story Generator — StorySpark AI" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    prompt: typeof s.prompt === "string" ? s.prompt : undefined,
  }),
  component: StoryGeneratorPage,
});

function StoryGeneratorPage() {
  const search = useSearch({ from: "/_app/story-generator" });
  const [prompt, setPrompt] = useState(
    search.prompt ?? "A shy fox who wants to make friends at school.",
  );
  const [story, setStory] = useState<string | null>(null);
  const [characters, setCharacters] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [songs, setSongs] = useState<string | null>(null);
  const [images, setImages] = useState<string | null>(null);
  const [seo, setSeo] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (p: string) => {
      setStory(null);
      setCharacters(null);
      setStoryboard(null);
      setVoice(null);
      setSongs(null);
      setImages(null);
      setSeo(null);
      const s = await generateStory({ data: { prompt: p } });
      setStory(s.story);
      const [c, sb, pack] = await Promise.all([
        generateCharacters({ data: { prompt: p, story: s.story } }),
        generateStoryboard({ data: { prompt: p, story: s.story } }),
        generateMediaPack({ data: { prompt: p, story: s.story } }),
      ]);
      return {
        story: s.story,
        characters: c.characters,
        storyboard: sb.storyboard,
        voice: pack.voice,
        songs: pack.songs,
        images: pack.images,
        seo: pack.seo,
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
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to generate"),
  });
  function generate() {
    mutation.mutate(prompt);
  }

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
              <Badge key={t} variant="secondary" className="cursor-pointer rounded-full" onClick={() => setPrompt((p) => p + ` (theme: ${t})`)}>{t}</Badge>
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
              <p className="text-xs text-muted-foreground">Pick a character and render the movie in Video Studio.</p>
            </div>
          </div>
          <Button asChild className="rounded-xl gradient-primary text-white shadow-glow">
            <Link to="/video-studio">
              Generate the movie <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

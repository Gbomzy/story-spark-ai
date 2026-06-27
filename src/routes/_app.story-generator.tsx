import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateStory, generateCharacters, generateStoryboard } from "@/lib/qwen.functions";
import { OutputWorkspace } from "@/components/output-workspace";

export const Route = createFileRoute("/_app/story-generator")({
  head: () => ({ meta: [{ title: "Story Generator — StorySpark AI" }] }),
  component: StoryGeneratorPage,
});

function StoryGeneratorPage() {
  const [prompt, setPrompt] = useState("A shy fox who wants to make friends at school.");
  const [story, setStory] = useState<string | null>(null);
  const [characters, setCharacters] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (p: string) => {
      setStory(null);
      setCharacters(null);
      setStoryboard(null);
      const s = await generateStory({ data: { prompt: p } });
      setStory(s.story);
      const [c, sb] = await Promise.all([
        generateCharacters({ data: { prompt: p, story: s.story } }),
        generateStoryboard({ data: { prompt: p, story: s.story } }),
      ]);
      return { story: s.story, characters: c.characters, storyboard: sb.storyboard };
    },
    onSuccess: (res) => {
      setStory(res.story);
      setCharacters(res.characters);
      setStoryboard(res.storyboard);
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
        }}
        status={mutation.isPending ? "generating" : story || characters || storyboard ? "ready" : "awaiting"}
      />
    </div>
  );
}

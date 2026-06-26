import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/story-generator")({
  head: () => ({ meta: [{ title: "Story Generator — StorySpark AI" }] }),
  component: StoryGeneratorPage,
});

function StoryGeneratorPage() {
  const [prompt, setPrompt] = useState("A shy fox who wants to make friends at school.");
  const [story, setStory] = useState<string | null>(null);

  function generate() {
    // TODO: call Qwen story API.
    setStory(
      `Once upon a time, in a forest of golden leaves, there was a little fox named Fenn.\n\nFenn loved books, autumn pies, and the soft hum of crickets — but when it came to meeting new friends, his tail went still as stone…`,
    );
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
          <Button onClick={generate} className="mt-4 w-full rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            <Sparkles className="mr-2 h-4 w-4" /> Generate story
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
    </div>
  );
}

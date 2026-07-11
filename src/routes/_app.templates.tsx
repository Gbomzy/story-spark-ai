import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/templates")({
  head: () => ({ meta: [{ title: "Templates — StorySpark AI" }] }),
  component: TemplatesPage,
});

type Template = { name: string; topic: string; duration: string; color: string; prompt: string };
const templates: Template[] = [
  { name: "Bedtime Adventure", topic: "Calm storytelling", duration: "5 min", color: "gradient-cool",
    prompt: "A cozy bedtime adventure about a sleepy bunny who follows a trail of stars home. Gentle pacing, dreamy imagery, soft narration suitable for ages 3–6." },
  { name: "Counting Caper", topic: "Math basics", duration: "3 min", color: "gradient-warm",
    prompt: "A cheerful caper about 10 mischievous ducklings the farmer must count back into the pond. Teach counting 1–10 with a catchy refrain, ages 3–5." },
  { name: "Tiny Scientist", topic: "STEM curiosity", duration: "6 min", color: "gradient-primary",
    prompt: "A curious kid inventor builds a paper rocket and discovers why things fall. Playful STEM narration with one clear science idea, ages 5–8." },
  { name: "Kindness Quest", topic: "Social emotional", duration: "4 min", color: "gradient-warm",
    prompt: "Two classmates go on a kindness quest around the schoolyard, each small act unlocking a new friend. Warm, hopeful tone, ages 4–7." },
  { name: "Space Explorers", topic: "Astronomy", duration: "7 min", color: "gradient-cool",
    prompt: "Young astronauts hop between the planets of the solar system meeting one silly alien on each. Include one true fact per planet, ages 6–9." },
  { name: "Eco Heroes", topic: "Sustainability", duration: "5 min", color: "gradient-primary",
    prompt: "A team of neighborhood kids becomes Eco Heroes, cleaning up a park and teaching what belongs in each recycling bin. Ages 5–8." },
  { name: "Ocean Whispers", topic: "Marine life", duration: "5 min", color: "gradient-cool",
    prompt: "A gentle blue whale gives a young sea turtle a tour of a coral reef, meeting friendly fish along the way. Calm, awe-filled tone, ages 4–7." },
  { name: "Jungle Rhymes", topic: "Rhyming reader", duration: "4 min", color: "gradient-warm",
    prompt: "A rhyming romp through the jungle where every animal speaks in a couplet. Punchy sing-song rhythm, ages 3–6." },
  { name: "Dragon Friends", topic: "Fantasy adventure", duration: "6 min", color: "gradient-primary",
    prompt: "A shy village kid befriends a tiny lost dragon and helps it find its family in the mountains. Warm fantasy, ages 5–9." },
  { name: "Robot Recess", topic: "Friendship & tech", duration: "5 min", color: "gradient-cool",
    prompt: "A helper robot joins recess for the first time and learns the rules of tag, sharing, and taking turns. Ages 4–7." },
  { name: "Farm Feelings", topic: "Emotional literacy", duration: "4 min", color: "gradient-warm",
    prompt: "Barn animals name and manage a big feeling each (worry, joy, jealousy, calm). Gentle SEL story, ages 4–6." },
  { name: "Dino Discovery", topic: "History & nature", duration: "6 min", color: "gradient-primary",
    prompt: "A pair of kids at a museum imagine a day walking with dinosaurs, meeting one herbivore and one carnivore safely. One true fact each, ages 5–8." },
];

function TemplatesPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageHeader title="Templates" description="Start from a proven format and remix to taste." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.name} className="glass overflow-hidden rounded-3xl p-0 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
            <div className={`relative grid h-28 place-items-center ${t.color}`}>
              <LayoutTemplate className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-3 p-5">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.topic}</p>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="rounded-full">{t.duration}</Badge>
                <Button
                  size="sm"
                  className="rounded-lg gradient-primary text-white shadow-glow hover:opacity-95"
                  onClick={() =>
                    navigate({ to: "/story-generator", search: { prompt: t.prompt } })
                  }
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Use
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

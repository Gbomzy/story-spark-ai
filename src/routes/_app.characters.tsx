import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Heart } from "lucide-react";

export const Route = createFileRoute("/_app/characters")({
  head: () => ({ meta: [{ title: "Characters — StorySpark AI" }] }),
  component: CharactersPage,
});

const characters = [
  { name: "Lila", trait: "Curious dreamer", tags: ["hero", "kind"], color: "gradient-warm", initial: "L" },
  { name: "Captain Cabbage", trait: "Goofy hero", tags: ["funny", "brave"], color: "gradient-cool", initial: "C" },
  { name: "Pixie", trait: "Magical guide", tags: ["wise", "sparkly"], color: "gradient-primary", initial: "P" },
  { name: "Mango", trait: "Brave explorer", tags: ["adventurous"], color: "gradient-warm", initial: "M" },
  { name: "Bubbles", trait: "Gentle giant", tags: ["calm", "ocean"], color: "gradient-cool", initial: "B" },
  { name: "Rusty", trait: "Recycling robot", tags: ["eco", "robot"], color: "gradient-primary", initial: "R" },
];

function CharactersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Characters"
        description="Reusable heroes, sidekicks and narrators — consistent across every video."
        actions={
          <Button className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            <Plus className="mr-2 h-4 w-4" /> New character
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {characters.map((c) => (
          <Card key={c.name} className="glass flex flex-col items-center rounded-3xl p-6 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
            <div className={`mb-3 grid h-20 w-20 place-items-center rounded-3xl ${c.color} text-2xl font-bold text-white shadow-glow`}>
              {c.initial}
            </div>
            <p className="font-semibold">{c.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.trait}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {c.tags.map((t) => <Badge key={t} variant="secondary" className="rounded-full text-[10px]">{t}</Badge>)}
            </div>
            <Button variant="ghost" size="sm" className="mt-3 rounded-lg text-xs">
              <Heart className="mr-1.5 h-3.5 w-3.5" /> Favorite
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

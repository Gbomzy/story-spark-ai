import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Film } from "lucide-react";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "Projects — StorySpark AI" }] }),
  component: ProjectsPage,
});

const projects = [
  { name: "Lila & the Friendly Star", topic: "Astronomy basics", age: "5–7", duration: "5 min", style: "Watercolor", status: "Rendering", color: "gradient-primary" },
  { name: "Counting with Captain Cabbage", topic: "Math: counting 1–10", age: "3–5", duration: "3 min", style: "Claymation", status: "Draft", color: "gradient-warm" },
  { name: "Tiny Astronauts on Mars", topic: "Space exploration", age: "6–8", duration: "7 min", style: "Pixar-style", status: "Published", color: "gradient-cool" },
  { name: "The Recycling Robots", topic: "Sustainability", age: "5–7", duration: "4 min", style: "Flat 2D", status: "Voiceover", color: "gradient-primary" },
  { name: "Bubbles the Brave Whale", topic: "Ocean life", age: "4–6", duration: "6 min", style: "Watercolor", status: "Storyboard", color: "gradient-cool" },
  { name: "Mango the Curious Monkey", topic: "Emotions", age: "3–6", duration: "5 min", style: "Cut-paper", status: "Draft", color: "gradient-warm" },
];

function ProjectsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // If a child route is active (e.g. /projects/new), render it instead of the list.
  if (pathname !== "/projects") return <Outlet />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Every story, voiceover and storyboard you're working on."
        actions={
          <Button asChild className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            <Link to="/projects/new"><Plus className="mr-2 h-4 w-4" /> New project</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Card key={p.name} className="glass overflow-hidden rounded-3xl p-0 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
            <div className={`relative h-32 ${p.color}`}>
              <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,white,transparent_60%)]" />
              </div>
              <Film className="absolute bottom-3 right-3 h-6 w-6 text-white/80" />
            </div>
            <div className="space-y-3 p-5">
              <div>
                <p className="font-semibold leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.topic}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="secondary" className="rounded-full">Ages {p.age}</Badge>
                <Badge variant="secondary" className="rounded-full">{p.duration}</Badge>
                <Badge variant="secondary" className="rounded-full">{p.style}</Badge>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Badge className="rounded-full" variant="outline">{p.status}</Badge>
                <Button size="sm" variant="ghost" className="rounded-lg">Open</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

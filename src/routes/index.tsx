import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Film, Mic, ArrowRight, BookOpen, Music, Palette } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trace } from "@/lib/startup-trace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StorySpark AI — Educational video stories from one prompt" },
      { name: "description", content: "A creative AI studio for parents, teachers and kids' content creators. Generate stories, voiceovers, songs and storyboards in minutes." },
      { property: "og:title", content: "StorySpark AI" },
      { property: "og:description", content: "Create educational video stories from a single prompt." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Wand2, title: "Story Generator", body: "Turn a one-liner into a structured, age-appropriate story." },
  { icon: Film, title: "Storyboard", body: "Auto-generate scene-by-scene visual storyboards." },
  { icon: Mic, title: "Voice Generator", body: "Natural narrator and character voices in any language." },
  { icon: Music, title: "Original Songs", body: "Composer-grade jingles and lullabies on demand." },
  { icon: Palette, title: "Image Prompts", body: "Beautiful, consistent character and scene art." },
  { icon: BookOpen, title: "SEO Studio", body: "Titles, descriptions and tags that actually rank." },
];

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { trace("Home (/) rendered"); }, []);
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute -top-40 left-1/4 h-[28rem] w-[28rem] rounded-full gradient-primary blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-[28rem] w-[28rem] rounded-full gradient-cool blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">StorySpark AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-xl">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-12 md:pt-20">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by Qwen — multimodal AI for storytellers
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Turn one prompt into a <span className="text-gradient">complete kids' video</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            StorySpark AI helps parents, teachers and creators generate stories, voiceovers, storyboards, songs and SEO — all from a single idea.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
              <Link to="/signup">
                Start creating <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl">
              <Link to="/dashboard">View dashboard demo</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 md:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass rounded-3xl p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white shadow-glow">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}

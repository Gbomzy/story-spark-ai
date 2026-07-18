import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Wand2,
  Film,
  Mic,
  ArrowRight,
  ArrowDown,
  Users,
  Image as ImageIcon,
  Megaphone,
  Clock,
  Award,
  Heart,
  PlayCircle,
  Lightbulb,
  Cpu,
  Layers,
  Rocket,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trace } from "@/lib/startup-trace";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StorySpark AI — Complete AI Story Production Studio" },
      { name: "description", content: "End-to-end AI storytelling platform powered by Alibaba Cloud Qwen AI. Generate stories, characters, storyboards, voice scripts, image prompts, songs and publishing assets from one prompt." },
      { property: "og:title", content: "StorySpark AI — Complete AI Story Production Studio" },
      { property: "og:description", content: "End-to-end AI storytelling platform powered by Alibaba Cloud Qwen AI. From one prompt to a complete production in minutes." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Wand2, title: "Story Generator", body: "Generate structured, engaging stories from a single prompt." },
  { icon: Users, title: "Character Creator", body: "Create consistent AI characters with detailed personalities." },
  { icon: Film, title: "Storyboard Studio", body: "Automatically transform stories into scene-by-scene storyboards." },
  { icon: Mic, title: "Voice Script Generator", body: "Generate narration and dialogue ready for voice production." },
  { icon: ImageIcon, title: "Image Prompt Generator", body: "Produce cinematic AI image prompts optimized for generation." },
  { icon: Megaphone, title: "AI Publishing Assistant", body: "Generate SEO titles, descriptions, metadata and publishing assets." },
];

const stats = [
  { value: "7+", label: "Integrated AI Tools" },
  { value: "1 Prompt", label: "Complete Workflow" },
  { value: "Minutes", label: "From Idea to Production" },
  { value: "Powered by", label: "Alibaba Cloud Qwen AI" },
];

const steps = [
  { icon: Lightbulb, title: "Enter your story idea", body: "Start with a single prompt or concept." },
  { icon: Cpu, title: "AI generates the complete story", body: "Qwen builds structure, characters and arc." },
  { icon: Layers, title: "Storyboard, voice & image prompts", body: "Scenes, narration and visuals are auto-created." },
  { icon: Rocket, title: "Export and publish", body: "Ship polished, production-ready assets." },
];

const benefits = [
  { icon: Clock, title: "Save Hours", body: "Automate repetitive creative work." },
  { icon: Award, title: "Professional Quality", body: "Generate structured content ready for production." },
  { icon: Heart, title: "Built for Creators", body: "Perfect for educators, parents, storytellers and content creators." },
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
        <div className="absolute bottom-0 left-0 h-[24rem] w-[24rem] rounded-full gradient-warm blur-3xl opacity-60" />
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
        {/* HERO */}
        <section className="mx-auto max-w-3xl text-center animate-fade-in">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium backdrop-blur shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Powered by Alibaba Cloud Qwen AI
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Turn One Prompt into a <span className="text-gradient">Complete AI Story Production Studio</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            StorySpark AI is an end-to-end storytelling platform powered by Alibaba Cloud Qwen AI. Generate stories, characters, storyboards, voice scripts, image prompts, songs and publishing assets—all from a single idea in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
              <Link to="/signup">
                Start Creating Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl backdrop-blur">
              <Link to="/dashboard">
                <PlayCircle className="mr-2 h-4 w-4" /> Watch Demo
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            No coding required • AI Powered • End-to-End Workflow
          </p>
        </section>

        {/* FEATURES */}
        <section className="mt-24 grid gap-4 md:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="glass rounded-3xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white shadow-glow">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </section>

        {/* WHY STORYSPARK / STATS */}
        <section className="mt-28 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything You Need to <span className="text-gradient">Produce Stories with AI</span>
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="glass rounded-3xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="text-2xl font-bold text-gradient md:text-3xl">{s.value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mt-28">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How It Works</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              From a spark of an idea to a finished production in four steps.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4 md:gap-2">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative flex flex-col">
                  <div className="glass flex h-full flex-col rounded-3xl p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-glow">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <>
                      <ArrowRight className="pointer-events-none absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-primary/60 md:block" />
                      <ArrowDown className="mx-auto my-2 h-5 w-5 text-primary/60 md:hidden" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* BENEFITS */}
        <section className="mt-28 grid gap-4 md:grid-cols-3">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="glass rounded-3xl p-8 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-glow"
              >
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl gradient-primary text-white shadow-glow">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
              </div>
            );
          })}
        </section>

        {/* FINAL CTA */}
        <section className="mt-28">
          <div className="glass relative overflow-hidden rounded-4xl p-10 text-center shadow-glow md:p-16">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full gradient-primary blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
                Start Building <span className="text-gradient">Amazing Stories</span> with AI
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground md:text-lg">
                Transform your ideas into complete storytelling projects using Alibaba Cloud Qwen AI.
              </p>
              <div className="mt-8 flex justify-center">
                <Button asChild size="lg" className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
                  <Link to="/signup">
                    Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

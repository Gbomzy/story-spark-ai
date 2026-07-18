import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  PlayCircle,
  Check,
  X,
  Music,
  Search,
  ChevronDown,
  Star,
  GraduationCap,
  Baby,
  Clapperboard,
  Rocket,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { trace } from "@/lib/startup-trace";
import dashboardAsset from "@/assets/screens/dashboard.jpg.asset.json";
import storyAsset from "@/assets/screens/story-generator.jpg.asset.json";
import agentsAsset from "@/assets/screens/ai-agents.jpg.asset.json";
import storyboardAsset from "@/assets/screens/storyboard.jpg.asset.json";
import voiceAsset from "@/assets/screens/voice-generator.jpg.asset.json";
import imageAsset from "@/assets/screens/image-prompts.jpg.asset.json";
import videoAsset from "@/assets/screens/video-studio.jpg.asset.json";
import publishingAsset from "@/assets/screens/publishing.jpg.asset.json";
import charactersAsset from "@/assets/screens/characters.jpg.asset.json";

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
        <div className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full gradient-primary blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full gradient-cool blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">StorySpark AI</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground transition">Features</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
          <a href="#faq" className="hover:text-foreground transition">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" className="rounded-xl">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-14">
        {/* SECTION 1 — HERO */}
        <section className="grid items-center gap-12 lg:grid-cols-2 animate-fade-in">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs font-medium backdrop-blur shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Powered by Alibaba Cloud Qwen AI
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              Turn One Prompt Into a{" "}
              <span className="text-gradient">Complete Children's Video</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Generate stories, AI characters, storyboards, voiceovers, image prompts, SEO metadata, and publish finished videos from one workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
                <Link to="/signup">Start Creating Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl backdrop-blur">
                <a href="#features"><PlayCircle className="mr-2 h-4 w-4" /> Watch Demo</a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {["Story Generation","Storyboards","Voice","Video","Publishing"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" />{t}</span>
              ))}
            </div>
          </div>
          <BrowserFrame src={dashboardAsset.url} alt="StorySpark AI dashboard" priority />
        </section>

        {/* SECTION 2 — TRUST BAR */}
        <section className="mt-24">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Powered by
          </p>
          <div className="mt-6 grid grid-cols-2 items-center gap-6 opacity-70 sm:grid-cols-3 md:grid-cols-7">
            {["Alibaba Cloud Qwen","DashScope","Wan Video","Qwen Image","Supabase","Lovable","GitHub"].map((n) => (
              <div key={n} className="text-center text-sm font-semibold text-muted-foreground grayscale transition hover:grayscale-0 hover:text-foreground">
                {n}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3-10 — ALTERNATING PRODUCT SECTIONS */}
        <section id="features" className="mt-28 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Everything You Need To <span className="text-gradient">Produce Children's Stories</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            A complete production studio in your browser — from first prompt to published video.
          </p>
        </section>

        <Alternating
          reverse={false}
          image={dashboardAsset.url}
          eyebrow="Workspace"
          title="Manage Every Story In One Workspace"
          body="Organize projects, characters, assets, rendering and publishing from one modern dashboard."
          bullets={["Projects","Credits","Render Queue","Publishing","Analytics"]}
        />
        <Alternating
          reverse
          image={storyAsset.url}
          eyebrow="Story Generator"
          title="Generate Rich Educational Stories"
          body="One prompt generates a fully structured story with educational objectives, chapter flow, characters and age-appropriate arcs."
          bullets={["Learning objectives","Age targeting","Chapter structure","Multiple languages"]}
        />
        <Alternating
          reverse={false}
          image={charactersAsset.url}
          eyebrow="Character Creator"
          title="Consistent AI Characters"
          body="Build a cast that stays visually and emotionally consistent across every scene, voice and story."
          bullets={["Appearance","Personality","Voice","Backstory","Relationships"]}
        />
        <Alternating
          reverse
          image={storyboardAsset.url}
          eyebrow="Storyboard"
          title="Automatic Storyboards"
          body="Every story is automatically transformed into scene-by-scene visual directions with camera, motion and shot notes."
          bullets={["Scene decomposition","Camera direction","Shot notes","Live editing"]}
        />
        <Alternating
          reverse={false}
          image={voiceAsset.url}
          eyebrow="Voice Studio"
          title="Studio Quality Voice Generation"
          body="Cast a narrator, preview instantly, and export production-ready audio with matching subtitles."
          bullets={["Voice selection","Audio preview","Subtitles","Export"]}
        />
        <Alternating
          reverse
          image={imageAsset.url}
          eyebrow="Image Generation"
          title="Generate Every Scene"
          body="Turn each storyboard scene into consistent illustrations using Qwen Image — same characters, same world, every frame."
          bullets={["Character consistency","Scene coverage","Multiple styles","One-click regenerate"]}
        />
        <Alternating
          reverse={false}
          image={videoAsset.url}
          eyebrow="Video Studio"
          title="Create Animated Videos"
          body="Render scene clips with Wan Video, then compose the finished movie end-to-end without leaving the app."
          bullets={["Scene clips","Background rendering","Movie composition","Powered by Wan Video"]}
        />
        <Alternating
          reverse
          image={publishingAsset.url}
          eyebrow="Publishing Center"
          title="Publish Everywhere"
          body="Connect your accounts once and publish finished movies to every major platform in a click."
          bullets={["YouTube","TikTok","Instagram","Facebook","LinkedIn","X"]}
        />

        {/* SECTION 11 — HOW IT WORKS */}
        <section id="how" className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">How It Works</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              From a spark of an idea to a published film — in five steps.
            </p>
          </div>
          <ol className="relative mx-auto mt-14 max-w-3xl">
            <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-primary/60 via-primary/30 to-transparent md:left-1/2 md:-ml-px" />
            {[
              { t: "Describe your idea", d: "One prompt. Any topic, any age group." },
              { t: "AI agents collaborate", d: "Story, character, image, voice and SEO agents work in parallel." },
              { t: "Generate assets", d: "Storyboards, voices, images and songs are produced automatically." },
              { t: "Render movie", d: "Scene clips render in the background and compose into a finished film." },
              { t: "Publish", d: "Ship straight to YouTube, TikTok, Instagram and more." },
            ].map((s, i) => (
              <li key={s.t} className="relative mb-8 grid md:grid-cols-2 md:gap-8">
                <div className={i % 2 === 0 ? "md:pr-12 md:text-right" : "md:col-start-2 md:pl-12"}>
                  <div className="glass rounded-2xl p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
                    <div className="text-xs font-semibold uppercase tracking-wider text-primary">Step {i + 1}</div>
                    <div className="mt-1 text-lg font-semibold">{s.t}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
                  </div>
                </div>
                <span className="absolute left-6 top-4 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full gradient-primary shadow-glow md:left-1/2" />
              </li>
            ))}
          </ol>
        </section>

        {/* SECTION 12 — AI AGENTS */}
        <section className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              A <span className="text-gradient">Team of Specialist AI Agents</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Each agent owns a craft. Together they ship a finished production.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Wand2, name: "Story Agent", status: "thinking" as const, task: "Drafting chapter 3" },
              { icon: Users, name: "Character Agent", status: "working" as const, task: "Building cast" },
              { icon: Film, name: "Storyboard Agent", status: "working" as const, task: "Framing scene 6" },
              { icon: Mic, name: "Voice Agent", status: "thinking" as const, task: "Synthesising narrator" },
              { icon: ImageIcon, name: "Image Agent", status: "working" as const, task: "Rendering scene visuals" },
              { icon: Search, name: "SEO Agent", status: "completed" as const, task: "Metadata ready" },
              { icon: Music, name: "Song Agent", status: "completed" as const, task: "Theme composed" },
              { icon: Megaphone, name: "Publishing Agent", status: "thinking" as const, task: "Preparing release" },
            ].map((a) => (
              <AgentTile key={a.name} {...a} />
            ))}
          </div>
        </section>

        {/* SECTION 13 — COMPARISON */}
        <section className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Why StorySpark AI</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">One platform replaces a fragmented tool chain.</p>
          </div>
          <div className="glass mt-10 overflow-hidden rounded-3xl shadow-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Capability</th>
                  <th className="px-6 py-4">Traditional Workflow</th>
                  <th className="px-6 py-4 text-primary">StorySpark AI</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "Story writing","Characters","Storyboards","Voiceovers",
                  "Image prompts","SEO","Publishing","Multiple AI agents","Video rendering",
                ].map((row, i) => (
                  <tr key={row} className={i % 2 ? "bg-muted/20" : ""}>
                    <td className="px-6 py-3 font-medium">{row}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><X className="h-4 w-4 text-destructive/70" /> Separate tool</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1.5 font-medium"><Check className="h-4 w-4 text-primary" /> Built-in</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 14 — USE CASES */}
        <section className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Built For Every Storyteller</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: GraduationCap, title: "Teachers", body: "Turn lessons into animated stories that stick." },
              { icon: Baby, title: "Parents", body: "Create personalised bedtime videos for your kids." },
              { icon: Clapperboard, title: "Animation Studios", body: "Pre-visualise scripts and produce shorts in hours." },
              { icon: Rocket, title: "Content Creators", body: "Ship channel-ready videos across every platform." },
            ].map((u) => {
              const Icon = u.icon;
              return (
                <div key={u.title} className="glass rounded-3xl p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white shadow-glow">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-lg font-semibold">{u.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{u.body}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 15 — TESTIMONIALS */}
        <TestimonialCarousel />

        {/* SECTION 16 — PRICING */}
        <section id="pricing" className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Simple, Creator-Friendly Pricing</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Start free. Upgrade when your studio grows.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Starter", price: "Free", tag: "For exploring", features: ["1 project","Story generator","Basic voices","720p exports"], cta: "Start free" },
              { name: "Creator", price: "$19", tag: "For solo creators", features: ["Unlimited projects","Full agent team","HD voices","1080p exports","Publishing"], cta: "Choose Creator" },
              { name: "Studio", price: "$49", tag: "Most popular", featured: true, features: ["Everything in Creator","4K rendering","Priority render queue","Team workspace","API access"], cta: "Choose Studio" },
              { name: "Enterprise", price: "Custom", tag: "For teams at scale", features: ["SSO & audit logs","Dedicated capacity","Custom integrations","Onboarding & SLA"], cta: "Contact sales" },
            ].map((p) => (
              <div key={p.name} className={`relative rounded-3xl p-6 shadow-soft transition hover:-translate-y-1 ${p.featured ? "gradient-primary text-white shadow-glow" : "glass"}`}>
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-0.5 text-xs font-semibold text-primary shadow-soft">Most popular</span>
                )}
                <div className={`text-xs font-semibold uppercase tracking-wider ${p.featured ? "text-white/80" : "text-muted-foreground"}`}>{p.tag}</div>
                <div className="mt-1 text-xl font-bold">{p.name}</div>
                <div className="mt-2 text-3xl font-bold">{p.price}{p.price.startsWith("$") && <span className={`ml-1 text-sm font-normal ${p.featured ? "text-white/80" : "text-muted-foreground"}`}>/mo</span>}</div>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className={`h-4 w-4 ${p.featured ? "text-white" : "text-primary"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className={`mt-6 w-full rounded-xl ${p.featured ? "bg-white text-primary hover:bg-white/90" : "gradient-primary text-white shadow-glow hover:opacity-95"}`}>
                  <Link to="/signup">{p.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 17 — FAQ */}
        <section id="faq" className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Frequently Asked Questions</h2>
          </div>
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {[
              { q: "How does StorySpark work?", a: "You describe your story idea. A team of AI agents generates the story, characters, storyboard, voices, images, songs and publishing metadata — then renders the finished video." },
              { q: "What AI models power StorySpark?", a: "Alibaba Cloud Qwen for story and reasoning, Qwen Image for scene generation, Wan Video for video rendering, and DashScope for voice and audio pipelines." },
              { q: "Can I publish directly?", a: "Yes. Connect YouTube, TikTok, Instagram, Facebook, LinkedIn and X from the Publishing Center and push finished videos in a click." },
              { q: "Can I export assets?", a: "Absolutely. Every story, storyboard, voice track, image and finished movie is downloadable from the workspace." },
              { q: "Can I create videos?", a: "Yes. Scene clips render in the background with Wan Video and are composed into a finished movie automatically." },
              { q: "Do I own my content?", a: "You own everything you generate. StorySpark grants you full rights to your stories, characters and videos." },
            ].map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </section>

        {/* SECTION 18 — FINAL CTA */}
        <section className="mt-32">
          <div className="relative overflow-hidden rounded-4xl p-10 text-center shadow-glow md:p-16 gradient-primary text-white">
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute -top-20 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-white/30 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
                Start Creating Children's Stories With AI Today
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/90 md:text-lg">
                Join creators, educators and studios producing complete films from a single prompt.
              </p>
              <div className="mt-8 flex justify-center">
                <Button asChild size="lg" className="rounded-xl bg-white text-primary shadow-glow hover:bg-white/90">
                  <Link to="/signup">Create Your First Story Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-20 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg gradient-primary">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span>© {new Date().getFullYear()} StorySpark AI</span>
          </div>
          <span>Powered by Alibaba Cloud Qwen AI</span>
        </footer>
      </main>
    </div>
  );
}

/* ---------------- Presentation subcomponents ---------------- */

function BrowserFrame({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="relative animate-fade-in">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] gradient-primary opacity-30 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-glow backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/60 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-amber-400/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
          <div className="mx-auto rounded-md bg-background/60 px-3 py-0.5 text-[10px] text-muted-foreground">
            storyspark.ai
          </div>
        </div>
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          className="block w-full"
        />
      </div>
    </div>
  );
}

function Alternating({
  reverse, image, eyebrow, title, body, bullets,
}: {
  reverse: boolean; image: string; eyebrow: string; title: string; body: string; bullets: string[];
}) {
  return (
    <section className="mt-24 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <BrowserFrame src={image} alt={title} />
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
        <h3 className="mt-2 text-2xl font-bold tracking-tight md:text-4xl">{title}</h3>
        <p className="mt-4 text-muted-foreground md:text-lg">{body}</p>
        <ul className="mt-6 grid grid-cols-2 gap-2 text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AgentTile({
  icon: Icon, name, task, status,
}: {
  icon: typeof Wand2; name: string; task: string; status: "thinking" | "working" | "completed";
}) {
  const chip =
    status === "thinking" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    : status === "working" ? "bg-primary/15 text-primary"
    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  const label = status === "thinking" ? "Thinking" : status === "working" ? "Working" : "Completed";
  return (
    <div className="glass group relative overflow-hidden rounded-3xl p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-glow">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl gradient-primary text-white shadow-glow">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{task}</div>
        </div>
      </div>
      <div className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${chip}`}>
        {status !== "completed" && (
          <span className="inline-flex gap-0.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-current" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
          </span>
        )}
        {status === "completed" && <Check className="h-3 w-3" />}
        {label}
      </div>
    </div>
  );
}

const TESTIMONIALS = [
  { name: "Ada (demo)", role: "Kindergarten teacher", body: "I turn weekly lesson plans into animated stories my students actually ask to re-watch. What used to take a weekend now takes an evening." },
  { name: "Marco (demo)", role: "Indie animator", body: "Pre-visualising a short film used to mean a full storyboard team. StorySpark gives me a rough cut before I finish my coffee." },
  { name: "Jules (demo)", role: "Parent creator", body: "My kids love seeing themselves as characters. The consistency across scenes is what convinced me — it actually feels like one film." },
];

function TestimonialCarousel() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(t);
  }, []);
  const t = TESTIMONIALS[i];
  return (
    <section className="mt-32">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Loved By Storytellers</h2>
        <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Demo testimonials — placeholders for beta feedback</p>
      </div>
      <div className="mx-auto mt-10 max-w-3xl">
        <div key={t.name} className="glass animate-fade-in rounded-3xl p-8 text-center shadow-soft md:p-12">
          <div className="mx-auto mb-4 flex justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, k) => (
              <Star key={k} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="text-lg font-medium md:text-2xl">"{t.body}"</blockquote>
          <div className="mt-6 text-sm text-muted-foreground">{t.name} — {t.role}</div>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {TESTIMONIALS.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Show testimonial ${k + 1}`}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 gradient-primary" : "w-3 bg-muted"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-2xl px-5 shadow-soft transition">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-semibold">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180 text-primary" : ""}`} />
      </button>
      {open && <p className="pb-4 text-sm text-muted-foreground">{a}</p>}
    </div>
  );
}

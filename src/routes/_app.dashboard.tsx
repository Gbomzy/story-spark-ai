import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { listProjects } from "@/lib/projects";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Sparkles,
  TrendingUp,
  Clock,
  BookOpen,
  Heart,
  Zap,
  Mic,
  Film,
  Music,
  Wand2,
  Users,
  ImageIcon,
  Bot,
  Download,
  CheckCircle2,
  Bell,
  FileVideo,
  FileText,
  FileAudio,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — StorySpark AI" }] }),
  component: DashboardPage,
});

const PROJECT_COLORS = ["gradient-primary", "gradient-warm", "gradient-cool"];

const savedStories = [
  { title: "Bubbles the Brave Whale", chapters: 6 },
  { title: "Pixie & the Rainbow Bridge", chapters: 4 },
  { title: "Mango the Curious Monkey", chapters: 8 },
];

const favoriteCharacters = [
  { name: "Lila", trait: "Curious dreamer", color: "gradient-warm", initial: "L" },
  { name: "Cap. Cabbage", trait: "Goofy hero", color: "gradient-cool", initial: "C" },
  { name: "Pixie", trait: "Magical guide", color: "gradient-primary", initial: "P" },
  { name: "Mango", trait: "Brave explorer", color: "gradient-warm", initial: "M" },
];

const quickActions = [
  { label: "New story", icon: Wand2, to: "/story-generator", tone: "gradient-primary" },
  { label: "New character", icon: Users, to: "/characters", tone: "gradient-warm" },
  { label: "Storyboard", icon: Film, to: "/storyboard", tone: "gradient-cool" },
  { label: "Voice over", icon: Mic, to: "/voice-generator", tone: "gradient-primary" },
  { label: "Image prompts", icon: ImageIcon, to: "/image-prompts", tone: "gradient-warm" },
  { label: "AI Agents", icon: Bot, to: "/ai-agents", tone: "gradient-cool" },
] as const;

const activity = [
  { icon: CheckCircle2, text: "Story Agent finished 'Lila & the Friendly Star'", time: "2m ago", tone: "text-emerald-500" },
  { icon: Mic, text: "Voiceover render started for 'Tiny Astronauts'", time: "18m ago", tone: "text-primary" },
  { icon: ImageIcon, text: "12 new image prompts generated", time: "1h ago", tone: "text-primary" },
  { icon: Bell, text: "Template 'Bedtime Adventures' added to library", time: "Yesterday", tone: "text-muted-foreground" },
  { icon: Users, text: "Character 'Bubbles' favourited", time: "Yesterday", tone: "text-muted-foreground" },
];

const recentExports = [
  { name: "lila-friendly-star.mp4", kind: "Video", size: "184 MB", icon: FileVideo },
  { name: "tiny-astronauts-script.pdf", kind: "Script", size: "1.2 MB", icon: FileText },
  { name: "recycling-robots-vo.wav", kind: "Audio", size: "42 MB", icon: FileAudio },
];

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Sparkles;
  tone: "primary" | "warm" | "cool";
}) {
  const toneClass = tone === "primary" ? "gradient-primary" : tone === "warm" ? "gradient-warm" : "gradient-cool";
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClass} text-white shadow-glow`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function DashboardPage() {
  const { profile, user } = useAuth();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: listProjects });

  const recent = useMemo(() => projects.slice(0, 4), [projects]);
  const counts = useMemo(() => {
    return {
      stories: projects.filter((p) => p.story).length,
      voice: projects.filter((p) => p.voice).length,
      storyboards: projects.filter((p) => p.storyboard).length,
      songs: projects.filter((p) => p.songs).length,
    };
  }, [projects]);
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "creator";
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section className="relative overflow-hidden rounded-3xl gradient-hero p-8 text-white shadow-glow">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 sm:flex sm:justify-between">
          <div className="min-w-0">
            <Badge className="mb-3 rounded-full border-0 bg-white/20 text-white backdrop-blur">
              <Sparkles className="mr-1 h-3 w-3" /> 7-day creative streak
            </Badge>
            <h2 className="text-2xl font-bold sm:text-3xl">Welcome back, {displayName} ✨</h2>
            <p className="mt-2 max-w-lg text-sm text-white/85 sm:text-base">
              You're three sparks away from your next milestone. What story do you want to tell today?
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 rounded-xl bg-white text-primary hover:bg-white/90">
            <Link to="/projects/new">
              <Plus className="mr-2 h-4 w-4" /> Create New Project
            </Link>
          </Button>
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                to={a.to}
                className="glass group flex flex-col items-start gap-3 rounded-2xl p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${a.tone} text-white shadow-glow transition group-hover:scale-110`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total projects" value={String(projects.length)} hint="Across your library" icon={BookOpen} tone="primary" />
        <StatCard label="Voice scripts" value={String(counts.voice)} hint="Ready to record" icon={Mic} tone="warm" />
        <StatCard label="Storyboards" value={String(counts.storyboards)} hint="Scene-by-scene" icon={Film} tone="cool" />
        <StatCard label="Songs composed" value={String(counts.songs)} hint="Lyrics generated" icon={Music} tone="primary" />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {/* Recent projects */}
        <Card className="glass col-span-2 rounded-3xl p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent projects</h3>
            <Button asChild variant="ghost" size="sm" className="rounded-lg">
              <Link to="/projects">View all</Link>
            </Button>
          </div>
          <ul className="space-y-3">
            {recent.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No projects yet. <Link to="/projects/new" className="font-medium text-primary hover:underline">Create your first project</Link>.
              </li>
            ) : recent.map((p, i) => (
              <li key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4 transition hover:bg-card hover:shadow-soft">
                <Link to="/projects/$id" params={{ id: p.id }} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${PROJECT_COLORS[i % 3]} text-white shadow-glow`}>
                  <Film className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                  <Link to="/projects/$id" params={{ id: p.id }} className="block truncate font-semibold hover:underline">{p.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">{p.topic || "Untitled topic"}{p.age_group ? ` • Ages ${p.age_group}` : ""}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 rounded-full">
                  {new Date(p.updated_at).toLocaleDateString()}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Usage */}
        <Card className="glass rounded-3xl p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">AI usage</h3>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-5">
            <UsageBar label="Story tokens" value={68} hint="6.8K / 10K used" />
            <UsageBar label="Voice minutes" value={42} hint="84 / 200 min" />
            <UsageBar label="Images generated" value={81} hint="162 / 200" />
            <UsageBar label="Render credits" value={23} hint="46 / 200" />
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-border p-4">
            <p className="text-xs text-muted-foreground">
              <Zap className="mr-1 inline h-3.5 w-3.5 text-primary" />
              Upgrade to Studio for unlimited Qwen renders.
            </p>
          </div>
        </Card>
      </section>

      {/* Saved stories + Characters */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="glass rounded-3xl p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Saved stories</h3>
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <ul className="space-y-3">
            {savedStories.map((s) => (
              <li
                key={s.title}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.chapters} chapters</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Updated today
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="glass rounded-3xl p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Favorite characters</h3>
            <Heart className="h-4 w-4 text-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {favoriteCharacters.map((c) => (
              <div key={c.name} className="flex flex-col items-center rounded-2xl border border-border/60 bg-card/60 p-4 text-center">
                <div className={`mb-2 grid h-12 w-12 place-items-center rounded-2xl ${c.color} text-lg font-bold text-white shadow-glow`}>
                  {c.initial}
                </div>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">{c.trait}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Activity timeline + Recent exports */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="glass rounded-3xl p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Activity timeline</h3>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <ol className="relative space-y-5 pl-5">
            <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
            {activity.map((a, i) => {
              const Icon = a.icon;
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-background bg-card shadow-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <div className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${a.tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{a.text}</p>
                      <p className="text-[11px] text-muted-foreground">{a.time}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="glass rounded-3xl p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent exports</h3>
            <Download className="h-4 w-4 text-primary" />
          </div>
          <ul className="space-y-3">
            {recentExports.map((e) => {
              const Icon = e.icon;
              return (
                <li key={e.name} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary text-white shadow-glow">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{e.kind} • {e.size}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" aria-label="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    </div>
  );
}

function UsageBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{hint}</span>
      </div>
      <Progress value={value} className="h-2 rounded-full" />
    </div>
  );
}

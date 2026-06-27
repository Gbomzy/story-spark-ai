import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Users,
  Film,
  Mic,
  Music,
  ImageIcon,
  Search,
  Zap,
  Clock,
  Check,
  Save,
  FileText,
  FileJson,
  FileType2,
  RefreshCw,
  Wand2,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { AgentCard, type Agent, type AgentStatus } from "@/components/agent-card";
import { OutputWorkspace } from "@/components/output-workspace";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { createProject, updateProject } from "@/lib/projects";
import {
  generateStory,
  generateCharacters,
  generateStoryboard,
  generateMediaPack,
} from "@/lib/qwen.functions";

type AgentKey =
  | "story"
  | "character"
  | "storyboard"
  | "voice"
  | "song"
  | "image"
  | "seo";

type AgentDef = {
  key: AgentKey;
  name: string;
  icon: Agent["icon"];
  tone: Agent["tone"];
  credits: number;
  seconds: number;
  thinkingTask: string;
  doneTask: string;
};

const AGENT_DEFS: AgentDef[] = [
  { key: "story", name: "Story Agent", icon: BookOpen, tone: "primary", credits: 8, seconds: 12, thinkingTask: "Drafting narrative arc and chapters", doneTask: "Story draft ready for review" },
  { key: "character", name: "Character Agent", icon: Users, tone: "warm", credits: 6, seconds: 10, thinkingTask: "Designing characters and personalities", doneTask: "Character bios ready" },
  { key: "storyboard", name: "Storyboard Agent", icon: Film, tone: "cool", credits: 10, seconds: 15, thinkingTask: "Breaking story into scenes and beats", doneTask: "Storyboard scenes ready" },
  { key: "voice", name: "Voice Agent", icon: Mic, tone: "primary", credits: 9, seconds: 14, thinkingTask: "Preparing narrator and dialogue script", doneTask: "Voice script ready" },
  { key: "song", name: "Song Agent", icon: Music, tone: "warm", credits: 7, seconds: 11, thinkingTask: "Composing lyrics and theme hooks", doneTask: "Song concept ready" },
  { key: "image", name: "Image Prompt Agent", icon: ImageIcon, tone: "cool", credits: 8, seconds: 12, thinkingTask: "Crafting scene prompts for visuals", doneTask: "Image prompts ready" },
  { key: "seo", name: "SEO Agent", icon: Search, tone: "primary", credits: 4, seconds: 7, thinkingTask: "Optimising title, tags and hashtags", doneTask: "SEO metadata ready" },
];

const animationStyles = ["Watercolor", "Claymation", "Pixar-style 3D", "Flat 2D", "Cut-paper", "Anime", "Hand-drawn", "Stop-motion"];
const languages = ["English", "Spanish", "Portuguese", "French", "German", "Hindi", "Mandarin", "Arabic"];
const ageRanges = ["2–4", "3–5", "4–6", "5–7", "6–8", "8–10"];

type ProjectForm = {
  name: string;
  topic: string;
  age: string;
  language: string;
  duration: number;
  objective: string;
  style: string;
};

const STEPS = [
  { id: 1, label: "Details" },
  { id: 2, label: "AI options" },
  { id: 3, label: "Generation" },
  { id: 4, label: "Results" },
] as const;

export function ProjectWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [form, setForm] = useState<ProjectForm>({
    name: "",
    topic: "",
    age: "5–7",
    language: "English",
    duration: 5,
    objective: "",
    style: "Watercolor",
  });
  const [enabled, setEnabled] = useState<Record<AgentKey, boolean>>({
    story: true,
    character: true,
    storyboard: true,
    voice: true,
    song: true,
    image: true,
    seo: true,
  });

  function back() {
    if (step === 1) navigate({ to: "/projects" });
    else setStep((s) => ((s - 1) as 1 | 2 | 3 | 4));
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Create a new project"
        description="A four-step wizard to brief our agents and produce a complete project."
      />

      <Stepper current={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {step === 1 && (
            <StepDetails
              form={form}
              setForm={setForm}
              onBack={back}
              onContinue={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepOptions
              enabled={enabled}
              setEnabled={setEnabled}
              onBack={back}
              onContinue={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepGeneration
              enabled={enabled}
              onBack={back}
              onContinue={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <StepResults
              form={form}
              enabled={enabled}
              onRegenerate={() => setStep(3)}
              onDone={(id) => navigate({ to: "/projects/$id", params: { id } })}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="glass flex items-center gap-2 rounded-2xl p-2 shadow-soft sm:gap-3 sm:p-3">
      {STEPS.map((s, i) => {
        const state = current === s.id ? "active" : current > s.id ? "done" : "todo";
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-semibold transition",
                state === "active" && "gradient-primary text-white shadow-glow",
                state === "done" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                state === "todo" && "bg-muted text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="h-4 w-4" /> : s.id}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-xs font-medium uppercase tracking-wider", state === "todo" && "text-muted-foreground")}>
                {s.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="hidden h-px flex-1 bg-border sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function StepDetails({
  form,
  setForm,
  onBack,
  onContinue,
}: {
  form: ProjectForm;
  setForm: (f: ProjectForm) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onContinue();
  }
  return (
    <Card className="glass rounded-3xl p-6 shadow-soft sm:p-8">
      <form className="space-y-6" onSubmit={submit}>
        <Field label="Project name">
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Lila & the Friendly Star"
            className="rounded-xl"
          />
        </Field>

        <Field label="Educational topic">
          <Input
            required
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="e.g. The water cycle, multiplication, kindness…"
            className="rounded-xl"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Target age">
            <Select value={form.age} onValueChange={(v) => setForm({ ...form, age: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ageRanges.map((a) => <SelectItem key={a} value={a}>Ages {a}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Language">
            <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label={`Story length — ${form.duration} min`}>
          <Slider
            min={1}
            max={15}
            step={1}
            value={[form.duration]}
            onValueChange={(v) => setForm({ ...form, duration: v[0] })}
            className="py-3"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>1 min</span><span>15 min</span>
          </div>
        </Field>

        <Field label="Animation style">
          <Select value={form.style} onValueChange={(v) => setForm({ ...form, style: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {animationStyles.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Learning objective">
          <Textarea
            required
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
            placeholder="By the end, the child should understand…"
            className="min-h-28 rounded-xl"
          />
        </Field>

        <WizardFooter onBack={onBack} backLabel="Cancel">
          <Button type="submit" className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
            Continue <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </WizardFooter>
      </form>
    </Card>
  );
}

function StepOptions({
  enabled,
  setEnabled,
  onBack,
  onContinue,
}: {
  enabled: Record<AgentKey, boolean>;
  setEnabled: (e: Record<AgentKey, boolean>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const active = AGENT_DEFS.filter((a) => enabled[a.key]);
  const credits = active.reduce((sum, a) => sum + a.credits, 0);
  const seconds = active.reduce((sum, a) => Math.max(sum, a.seconds), 0) + active.length * 2;

  return (
    <Card className="glass rounded-3xl p-6 shadow-soft sm:p-8">
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold">Which agents should run?</h3>
          <p className="text-sm text-muted-foreground">
            Toggle the specialists you need. You can always run more later.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {AGENT_DEFS.map((a) => {
            const Icon = a.icon;
            const on = enabled[a.key];
            const tone =
              a.tone === "primary" ? "gradient-primary" : a.tone === "warm" ? "gradient-warm" : "gradient-cool";
            return (
              <li key={a.key}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
                    on
                      ? "border-primary/40 bg-primary/5 shadow-soft"
                      : "border-border/60 bg-card/60 hover:bg-card",
                  )}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) =>
                      setEnabled({ ...enabled, [a.key]: v === true })
                    }
                    className="mt-1"
                  />
                  <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-glow", tone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <Zap className="mr-1 inline h-3 w-3" />
                      {a.credits} credits • ~{a.seconds}s
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="grid gap-3 sm:grid-cols-2">
          <EstimateCard
            icon={Zap}
            label="Estimated credits"
            value={`${credits}`}
            hint={`${active.length} of ${AGENT_DEFS.length} agents selected`}
          />
          <EstimateCard
            icon={Clock}
            label="Estimated time"
            value={`~${seconds}s`}
            hint="Agents run in parallel where possible"
          />
        </div>

        <WizardFooter onBack={onBack}>
          <Button
            disabled={active.length === 0}
            onClick={onContinue}
            className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95"
          >
            Start generation <Sparkles className="ml-1.5 h-4 w-4" />
          </Button>
        </WizardFooter>
      </div>
    </Card>
  );
}

function EstimateCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-primary text-white shadow-glow">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

type AgentRuntime = {
  def: AgentDef;
  status: AgentStatus;
  progress: number;
  task: string;
};

function StepGeneration({
  enabled,
  onBack,
  onContinue,
}: {
  enabled: Record<AgentKey, boolean>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const defs = useMemo(() => AGENT_DEFS.filter((d) => enabled[d.key]), [enabled]);
  const [runtimes, setRuntimes] = useState<AgentRuntime[]>(() =>
    defs.map((def, i) => ({
      def,
      status: i < 2 ? "thinking" : "queued",
      progress: 0,
      task: i < 2 ? def.thinkingTask : "Waiting in queue…",
    })),
  );
  const finishedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setRuntimes((prev) => {
        const next = prev.map((r) => {
          if (r.status === "ready") return r;
          if (r.status === "thinking") {
            const inc = 100 / (r.def.seconds * 2); // ~500ms ticks
            const np = Math.min(100, r.progress + inc);
            if (np >= 100) {
              return { ...r, progress: 100, status: "ready" as AgentStatus, task: r.def.doneTask };
            }
            return { ...r, progress: np };
          }
          return r;
        });
        // Promote next queued -> thinking if a slot frees up
        const activeCount = next.filter((r) => r.status === "thinking").length;
        if (activeCount < 2) {
          const idx = next.findIndex((r) => r.status === "queued");
          if (idx !== -1) {
            next[idx] = { ...next[idx], status: "thinking", task: next[idx].def.thinkingTask };
          }
        }
        return next;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const allDone = runtimes.every((r) => r.status === "ready");
  useEffect(() => {
    if (allDone && !finishedRef.current) {
      finishedRef.current = true;
      const t = setTimeout(onContinue, 700);
      return () => clearTimeout(t);
    }
  }, [allDone, onContinue]);

  const overall = Math.round(runtimes.reduce((s, r) => s + r.progress, 0) / Math.max(1, runtimes.length));

  return (
    <div className="space-y-6">
      <Card className="glass rounded-3xl p-6 shadow-soft sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Agents collaborating…</h3>
            <p className="text-sm text-muted-foreground">
              Live progress from your selected specialists. This is a UI preview — connect Qwen to produce real outputs.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full text-xs">
            {overall}% overall
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {runtimes.map((r) => (
            <motion.div
              key={r.def.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AgentCard
                agent={{
                  name: r.def.name,
                  icon: r.def.icon,
                  tone: r.def.tone,
                  status: r.status,
                  progress: Math.round(r.progress),
                  lastTask: r.task,
                }}
              />
            </motion.div>
          ))}
        </div>
      </Card>

      <WizardFooter onBack={onBack}>
        <Button
          disabled={!allDone}
          onClick={onContinue}
          className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95"
        >
          {allDone ? (
            <>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Open workspace
            </>
          ) : (
            "Generating…"
          )}
        </Button>
      </WizardFooter>
    </div>
  );
}

function StepResults({
  form,
  enabled,
  onRegenerate,
  onDone,
}: {
  form: ProjectForm;
  enabled: Record<AgentKey, boolean>;
  onRegenerate: () => void;
  onDone: (projectId: string) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const projectIdRef = useRef<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const storyMutation = useMutation({
    mutationFn: () =>
      generateStory({
        data: {
          prompt: `Project: ${form.name || "Untitled"}\nTopic: ${form.topic}\nLearning objective: ${form.objective}\nAnimation style: ${form.style}`,
          ageGroup: form.age,
          language: form.language,
          length: `${form.duration} minute read-aloud`,
          learningGoal: form.objective,
        },
      }),
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to generate story"),
  });

  const briefPrompt = `Project: ${form.name || "Untitled"}\nTopic: ${form.topic}\nLearning objective: ${form.objective}\nAnimation style: ${form.style}`;

  const charactersMutation = useMutation({
    mutationFn: (story?: string) =>
      generateCharacters({
        data: {
          prompt: briefPrompt,
          story,
          ageGroup: form.age,
          language: form.language,
        },
      }),
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to generate characters"),
  });

  const storyboardMutation = useMutation({
    mutationFn: (story?: string) =>
      generateStoryboard({
        data: {
          prompt: briefPrompt,
          story,
          ageGroup: form.age,
          language: form.language,
          style: form.style,
        },
      }),
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to generate storyboard"),
  });

  const mediaMutation = useMutation({
    mutationFn: (story: string) =>
      generateMediaPack({
        data: {
          prompt: briefPrompt,
          story,
          ageGroup: form.age,
          language: form.language,
          style: form.style,
        },
      }),
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Failed to generate media pack"),
  });

  useEffect(() => {
    if (enabled.story && !storyMutation.data && !storyMutation.isPending) {
      storyMutation.mutate();
    }
    if (enabled.character && !charactersMutation.data && !charactersMutation.isPending) {
      charactersMutation.mutate(undefined);
    }
    if (enabled.storyboard && !storyboardMutation.data && !storyboardMutation.isPending) {
      storyboardMutation.mutate(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storyText = storyMutation.data?.story ?? "";
  const needsMedia = enabled.voice || enabled.song || enabled.image || enabled.seo;
  useEffect(() => {
    if (
      needsMedia &&
      storyText &&
      !mediaMutation.data &&
      !mediaMutation.isPending
    ) {
      mediaMutation.mutate(storyText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyText, needsMedia]);

  const story = storyText;
  const characters = charactersMutation.data?.characters ?? "";
  const storyboard = storyboardMutation.data?.storyboard ?? "";
  const voice = enabled.voice ? (mediaMutation.data?.voice ?? "") : "";
  const songs = enabled.song ? (mediaMutation.data?.songs ?? "") : "";
  const images = enabled.image ? (mediaMutation.data?.images ?? "") : "";
  const seo = enabled.seo ? (mediaMutation.data?.seo ?? "") : "";
  const anyPending =
    storyMutation.isPending ||
    charactersMutation.isPending ||
    storyboardMutation.isPending ||
    mediaMutation.isPending;
  const anyContent = story || characters || storyboard || voice || songs || images || seo;
  const workspaceStatus: "awaiting" | "generating" | "ready" =
    anyPending ? "generating" : anyContent ? "ready" : "awaiting";

  // Auto-save / sync to database whenever new content arrives.
  useEffect(() => {
    if (!anyContent) return;
    let cancelled = false;
    (async () => {
      const patch = {
        name: form.name || "Untitled project",
        topic: form.topic || null,
        age_group: form.age || null,
        language: form.language || null,
        duration: form.duration || null,
        objective: form.objective || null,
        style: form.style || null,
        story: story || null,
        characters: characters || null,
        storyboard: storyboard || null,
        voice: voice || null,
        songs: songs || null,
        images: images || null,
        seo: seo || null,
      };
      try {
        if (!projectIdRef.current) {
          const created = await createProject(patch);
          projectIdRef.current = created.id;
          if (!cancelled) setSavedId(created.id);
        } else {
          await updateProject(projectIdRef.current, patch);
        }
        qc.invalidateQueries({ queryKey: ["projects"] });
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, characters, storyboard, voice, songs, images, seo]);

  function exportJson() {
    const payload = {
      project: form,
      agents: Object.entries(enabled).filter(([, v]) => v).map(([k]) => k),
      generatedAt: new Date().toISOString(),
      assets: { story, characters, storyboard, voice, songs, images, seo },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(form.name || "storyspark-project").toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Project JSON downloaded");
  }

  function exportText(ext: "pdf" | "docx") {
    const sections: Array<[string, string]> = [
      ["Story", story], ["Characters", characters], ["Storyboard", storyboard],
      ["Voice Script", voice], ["Songs", songs], ["Image Prompts", images], ["SEO", seo],
    ];
    const body = sections.map(([k, v]) => `=== ${k.toUpperCase()} ===\n\n${v || "(empty)"}\n`).join("\n");
    const blob = new Blob([`${form.name || "Untitled"}\n${form.topic}\n\n${body}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(form.name || "storyspark-project").toLowerCase().replace(/\s+/g, "-")}.${ext === "pdf" ? "txt" : "doc"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.message(`${ext.toUpperCase()} export`, { description: "Downloaded as plain text — wire up a renderer for formatted output." });
  }

  return (
    <div className="space-y-6">
      <Card className="glass rounded-3xl p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge className="mb-2 rounded-full border-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Check className="mr-1 h-3 w-3" /> Generation complete
            </Badge>
            <h3 className="text-xl font-semibold">{form.name || "Untitled project"}</h3>
            <p className="text-sm text-muted-foreground">
              {form.topic || "No topic"} • Ages {form.age} • {form.language} • {form.duration} min • {form.style}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={onRegenerate}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Generate Again
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => storyMutation.mutate()}
              disabled={storyMutation.isPending}
            >
              <Wand2 className="mr-1.5 h-4 w-4" /> Improve with AI
            </Button>
          </div>
        </div>
      </Card>

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
        status={workspaceStatus}
      />

      <Card className="glass rounded-3xl p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Export your project or save it to keep working later.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => exportText("pdf")}>
              <FileText className="mr-1.5 h-4 w-4" /> Export PDF
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => exportText("docx")}>
              <FileType2 className="mr-1.5 h-4 w-4" /> Export DOCX
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={exportJson}>
              <FileJson className="mr-1.5 h-4 w-4" /> Export JSON
            </Button>
            <Button
              onClick={() => {
                if (savedId) {
                  toast.success("Project saved");
                  onDone(savedId);
                } else {
                  toast.message("Saving…", { description: "Hang tight while we finish generating." });
                }
              }}
              disabled={!savedId}
              className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95"
            >
              <Save className="mr-1.5 h-4 w-4" /> Save Project
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function WizardFooter({
  onBack,
  backLabel = "Back",
  children,
}: {
  onBack: () => void;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
      <Button type="button" variant="ghost" onClick={onBack} className="rounded-xl">
        <ChevronLeft className="mr-1.5 h-4 w-4" /> {backLabel}
      </Button>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
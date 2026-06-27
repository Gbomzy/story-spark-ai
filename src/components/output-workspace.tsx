import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Film, Mic, Music, ImageIcon, Search, Copy, Download } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { value: "story", label: "Story", icon: BookOpen, placeholder: "Your generated story will appear here. Connect the Qwen API to populate." },
  { value: "characters", label: "Characters", icon: Users, placeholder: "Character descriptions, traits and arcs go here." },
  { value: "storyboard", label: "Storyboard", icon: Film, placeholder: "Scene-by-scene breakdown with camera moves and beats." },
  { value: "voice", label: "Voice Script", icon: Mic, placeholder: "Narrator and character lines, timed for voiceover." },
  { value: "songs", label: "Songs", icon: Music, placeholder: "Lyrics, melody hints and song structure." },
  { value: "images", label: "Image Prompts", icon: ImageIcon, placeholder: "Prompt-ready descriptions for every key scene." },
  { value: "seo", label: "SEO", icon: Search, placeholder: "Title, description, tags and hashtags optimised for discovery." },
] as const;

type TabKey = (typeof TABS)[number]["value"];

export type OutputWorkspaceValues = Partial<Record<TabKey, string>>;

export function OutputWorkspace({
  initialValues,
  status = "awaiting",
}: {
  initialValues?: OutputWorkspaceValues;
  status?: "awaiting" | "generating" | "ready";
} = {}) {
  const [values, setValues] = useState<Record<TabKey, string>>(() =>
    TABS.reduce(
      (acc, t) => ({ ...acc, [t.value]: initialValues?.[t.value] ?? "" }),
      {} as Record<TabKey, string>,
    ),
  );

  useEffect(() => {
    if (!initialValues) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const t of TABS) {
        const incoming = initialValues[t.value];
        if (typeof incoming === "string" && incoming.length > 0) {
          next[t.value] = incoming;
        }
      }
      return next;
    });
  }, [initialValues]);

  const badge =
    status === "ready"
      ? { label: "Qwen ready", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
      : status === "generating"
        ? { label: "Generating…", className: "bg-primary/15 text-primary" }
        : { label: "Awaiting Qwen", className: "" };

  return (
    <Card className="glass rounded-3xl p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Output workspace</h3>
          <p className="text-xs text-muted-foreground">Edit each asset before exporting to your project pipeline.</p>
        </div>
        <Badge
          variant="secondary"
          className={`rounded-full text-[10px] uppercase tracking-wider ${badge.className}`}
        >
          {badge.label}
        </Badge>
      </div>

      <Tabs defaultValue="story">
        <div className="-mx-1 overflow-x-auto">
          <TabsList className="flex w-max gap-1 rounded-xl bg-muted/60 p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="gap-2 rounded-lg px-3 text-xs data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-glow"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4 space-y-3">
            <Textarea
              value={values[t.value]}
              onChange={(e) => setValues((v) => ({ ...v, [t.value]: e.target.value }))}
              placeholder={t.placeholder}
              className="min-h-[220px] rounded-2xl bg-card/60 leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                {values[t.value].length} characters
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    navigator.clipboard.writeText(values[t.value]);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                </Button>
                <Button size="sm" className="rounded-lg gradient-primary text-white shadow-glow hover:opacity-95">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
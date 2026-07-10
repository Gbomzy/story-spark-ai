import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ChevronLeft, Save, FileJson, RefreshCw, BookOpen, Users, Film, Mic, Music, ImageIcon, Search, Copy, Settings2, Download } from "lucide-react";
import { toast } from "sonner";
import { getProject, touchOpened, updateProject, type ProjectContentField } from "@/lib/projects";
import {
  generateStory,
  generateCharacters,
  generateStoryboard,
  generateMediaPack,
} from "@/lib/qwen.functions";
import { SceneImagesPanel } from "@/components/media/scene-images-panel";
import { AudioPanel } from "@/components/media/audio-panel";
import { MusicPanel } from "@/components/media/music-panel";

export const Route = createFileRoute("/_app/projects/$id")({
  head: () => ({ meta: [{ title: "Project — StorySpark AI" }] }),
  component: ProjectDetailPage,
});

const TABS = [
  { value: "story" as ProjectContentField, label: "Story", icon: BookOpen },
  { value: "characters" as ProjectContentField, label: "Characters", icon: Users },
  { value: "storyboard" as ProjectContentField, label: "Storyboard", icon: Film },
  { value: "voice" as ProjectContentField, label: "Voice Script", icon: Mic },
  { value: "songs" as ProjectContentField, label: "Songs", icon: Music },
  { value: "images" as ProjectContentField, label: "Images", icon: ImageIcon },
  { value: "seo" as ProjectContentField, label: "SEO", icon: Search },
];

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  const [draft, setDraft] = useState<Record<ProjectContentField, string>>({
    story: "", characters: "", storyboard: "", voice: "", songs: "", images: "", seo: "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (project) {
      setDraft({
        story: project.story ?? "",
        characters: project.characters ?? "",
        storyboard: project.storyboard ?? "",
        voice: project.voice ?? "",
        songs: project.songs ?? "",
        images: project.images ?? "",
        seo: project.seo ?? "",
      });
      setDirty(false);
      touchOpened(id).catch(() => undefined);
    }
  }, [project, id]);

  const saveMut = useMutation({
    mutationFn: () => updateProject(id, draft),
    onSuccess: () => {
      toast.success("Project saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  function setField(field: ProjectContentField, value: string) {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
  }

  async function regenerate(field: ProjectContentField) {
    if (!project) return;
    const brief = `Project: ${project.name}\nTopic: ${project.topic ?? ""}\nLearning objective: ${project.objective ?? ""}\nAnimation style: ${project.style ?? ""}`;
    try {
      toast.loading(`Regenerating ${field}…`, { id: `regen-${field}` });
      if (field === "story") {
        const r = await generateStory({
          data: {
            prompt: brief,
            ageGroup: project.age_group ?? undefined,
            language: project.language ?? undefined,
            length: project.duration ? `${project.duration} minute read-aloud` : undefined,
            learningGoal: project.objective ?? undefined,
          },
        });
        setField("story", r.story);
      } else if (field === "characters") {
        const r = await generateCharacters({
          data: { prompt: brief, story: draft.story || undefined, ageGroup: project.age_group ?? undefined, language: project.language ?? undefined },
        });
        setField("characters", r.characters);
      } else if (field === "storyboard") {
        const r = await generateStoryboard({
          data: { prompt: brief, story: draft.story || undefined, ageGroup: project.age_group ?? undefined, language: project.language ?? undefined, style: project.style ?? undefined },
        });
        setField("storyboard", r.storyboard);
      } else {
        if (!draft.story) {
          toast.error("Generate a story first", { id: `regen-${field}` });
          return;
        }
        const r = await generateMediaPack({
          data: { prompt: brief, story: draft.story, ageGroup: project.age_group ?? undefined, language: project.language ?? undefined, style: project.style ?? undefined },
        });
        if (field === "voice") setField("voice", r.voice);
        if (field === "songs") setField("songs", r.songs);
        if (field === "images") setField("images", r.images);
        if (field === "seo") setField("seo", r.seo);
      }
      toast.success(`${field} regenerated`, { id: `regen-${field}` });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to regenerate ${field}`, { id: `regen-${field}` });
    }
  }

  function exportJson() {
    if (!project) return;
    const payload = { project: { ...project, ...draft }, exportedAt: new Date().toISOString() };
    download(`${slug(project.name)}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mb-2 h-5 w-5 animate-spin" /> Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h2 className="text-lg font-semibold">Project not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
        <Button asChild className="mt-4 rounded-xl"><Link to="/projects">Back to projects</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" className="-ml-2 rounded-lg" onClick={() => navigate({ to: "/projects" })}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Projects
        </Button>
      </div>

      <Card className="glass rounded-3xl p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">{project.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.topic || "Untitled topic"}{project.age_group ? ` • Ages ${project.age_group}` : ""}
              {project.language ? ` • ${project.language}` : ""}{project.duration ? ` • ${project.duration} min` : ""}
              {project.style ? ` • ${project.style}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {new Date(project.updated_at).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={exportJson}>
              <FileJson className="mr-1.5 h-4 w-4" /> Export JSON
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/export"><Download className="mr-1.5 h-4 w-4" /> Export Studio</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/project-settings/$id" params={{ id: project.id }}>
                <Settings2 className="mr-1.5 h-4 w-4" /> Settings
              </Link>
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending}
              className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95"
            >
              {saveMut.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-5 shadow-soft sm:p-6">
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
              {t.value === "images" && <SceneImagesPanel imagesText={draft.images} />}
              {t.value === "voice" && (
                <AudioPanel script={draft.voice} value={project.audio ?? null} />
              )}
              {t.value === "songs" && (
                <MusicPanel lyrics={draft.songs} value={project.music ?? null} />
              )}
              <Textarea
                value={draft[t.value]}
                onChange={(e) => setField(t.value, e.target.value)}
                placeholder={`No ${t.label.toLowerCase()} yet — click "Regenerate" to create it with AI.`}
                className="min-h-[320px] rounded-2xl bg-card/60 leading-relaxed"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">{draft[t.value].length} characters</p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => {
                      navigator.clipboard.writeText(draft[t.value]);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => regenerate(t.value)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      {dirty && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <Badge className="rounded-full bg-foreground text-background shadow-soft">Unsaved changes</Badge>
        </div>
      )}
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
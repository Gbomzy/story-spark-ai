import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listProjects, type ProjectRow } from "@/lib/projects";
import { PIPELINE, PIPELINE_FLOW, stageStatus, type PipelineStatus, type PipelineStageId } from "@/lib/pipeline";
import { SceneImagesPanel } from "@/components/media/scene-images-panel";
import { AudioPanel } from "@/components/media/audio-panel";
import { MusicPanel } from "@/components/media/music-panel";
import { ImageIcon, Mic, Music, Film, Captions, Image as ImageLucide, Sparkles, Loader2, CheckCircle2, Circle, XCircle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/media-studio")({
  head: () => ({ meta: [{ title: "Media Studio — StorySpark AI" }] }),
  component: MediaStudioPage,
});

function MediaStudioPage() {
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const project = projects?.[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Media Studio"
        description="Generate images, narration, music, subtitles, thumbnails and the final video for your latest project."
      />

      <WorkflowDiagram project={project} />

      {isLoading ? (
        <Card className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground shadow-soft">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading projects…
        </Card>
      ) : !project ? (
        <Card className="glass rounded-3xl p-8 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">Create a project first to unlock the media pipeline.</p>
          <Button asChild className="mt-4 rounded-xl gradient-primary text-white shadow-glow">
            <Link to="/story-generator">Start a story</Link>
          </Button>
        </Card>
      ) : (
        <MediaTabs project={project} />
      )}
    </div>
  );
}

function MediaTabs({ project }: { project: ProjectRow }) {
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Active project</p>
          <h3 className="text-lg font-bold">{project.name}</h3>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/projects/$id" params={{ id: project.id }}>Open project</Link>
        </Button>
      </div>

      <Tabs defaultValue="images">
        <div className="-mx-1 overflow-x-auto">
          <TabsList className="flex w-max gap-1 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="images" className="gap-2 rounded-lg px-3 text-xs data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-glow">
              <ImageIcon className="h-3.5 w-3.5" /> Images
            </TabsTrigger>
            <TabsTrigger value="narration" className="gap-2 rounded-lg px-3 text-xs data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-glow">
              <Mic className="h-3.5 w-3.5" /> Narration
            </TabsTrigger>
            <TabsTrigger value="music" className="gap-2 rounded-lg px-3 text-xs data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-glow">
              <Music className="h-3.5 w-3.5" /> Music
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-2 rounded-lg px-3 text-xs data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-glow">
              <Film className="h-3.5 w-3.5" /> Video
            </TabsTrigger>
            <TabsTrigger value="subtitles" className="gap-2 rounded-lg px-3 text-xs data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-glow">
              <Captions className="h-3.5 w-3.5" /> Subtitles
            </TabsTrigger>
            <TabsTrigger value="thumbnail" className="gap-2 rounded-lg px-3 text-xs data-[state=active]:gradient-primary data-[state=active]:text-white data-[state=active]:shadow-glow">
              <ImageLucide className="h-3.5 w-3.5" /> Thumbnail
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="images" className="mt-4">
          <SceneImagesPanel imagesText={project.images ?? ""} />
        </TabsContent>
        <TabsContent value="narration" className="mt-4">
          <AudioPanel script={project.voice ?? ""} value={project.voice_audio ? JSON.stringify(project.voice_audio) : project.audio} />
        </TabsContent>
        <TabsContent value="music" className="mt-4">
          <MusicPanel lyrics={project.songs ?? ""} value={project.background_music ? JSON.stringify(project.background_music) : project.music} />
        </TabsContent>
        <TabsContent value="video" className="mt-4">
          <PlaceholderCard
            icon={<Film className="h-5 w-5" />}
            title="Final video render"
            body="Once Wan is connected, this project will render into a full MP4 combining images, narration and music."
            actions={[<Button key="open" asChild className="rounded-xl gradient-primary text-white shadow-glow"><Link to="/video-studio">Open Video Studio</Link></Button>]}
          />
        </TabsContent>
        <TabsContent value="subtitles" className="mt-4">
          <PlaceholderCard icon={<Captions className="h-5 w-5" />} title="Subtitles (.srt)" body="Timed captions derived from the voice script will appear here." />
        </TabsContent>
        <TabsContent value="thumbnail" className="mt-4">
          <PlaceholderCard icon={<ImageLucide className="h-5 w-5" />} title="Cover thumbnail" body="A cover image for the video will be generated from the story once an image provider is connected." />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function PlaceholderCard({ icon, title, body, actions }: { icon: React.ReactNode; title: string; body: string; actions?: React.ReactNode[] }) {
  return (
    <Card className="glass rounded-2xl p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-glow">{icon}</div>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
          </div>
        </div>
        <Badge className="rounded-full bg-amber-500/15 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">Coming soon</Badge>
      </div>
      {actions && actions.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}

function WorkflowDiagram({ project }: { project: ProjectRow | null }) {
  const stages = PIPELINE_FLOW.map((id) => PIPELINE.find((s) => s.id === id)!).filter(Boolean);
  return (
    <Card className="glass rounded-3xl p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Media pipeline</h3>
        <Badge variant="outline" className="ml-auto rounded-full text-[10px]">Story → Video</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {stages.map((s, i) => {
          const status = stageStatus(project as unknown as Record<string, unknown> | null, s);
          return (
            <div key={s.id} className="flex items-center gap-2">
              <StageChip label={s.label} status={status} />
              {i < stages.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StageChip({ label, status }: { label: string; status: PipelineStatus }) {
  const Icon = status === "completed" ? CheckCircle2 : status === "generating" ? Loader2 : status === "failed" ? XCircle : Circle;
  const cls =
    status === "completed" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    : status === "generating" ? "bg-primary/15 text-primary"
    : status === "failed" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      <Icon className={`h-3 w-3 ${status === "generating" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

export type { PipelineStageId };
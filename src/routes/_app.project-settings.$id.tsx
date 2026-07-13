import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, updateProject, deleteProject } from "@/lib/projects";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDbError } from "@/lib/dbError";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Save, Loader2, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_app/project-settings/$id")({
  head: () => ({ meta: [{ title: "Project settings — StorySpark AI" }] }),
  component: ProjectSettingsPage,
});

type Extra = {
  brandColors?: string;
  thumbnailStyle?: string;
  creativity?: number;
  exportPreferences?: string[];
  autosaveSeconds?: number;
  collaboration?: "private" | "team" | "public";
  visibility?: "private" | "unlisted" | "public";
  aspectRatio?: string;
  resolution?: string;
  description?: string;
};

function ProjectSettingsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: project, isLoading } = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id) });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("en");
  const [audience, setAudience] = useState("");
  const [animation, setAnimation] = useState("");
  const [voice, setVoice] = useState("");
  const [platform, setPlatform] = useState("");
  const [provider, setProvider] = useState("qwen");
  const [extra, setExtra] = useState<Extra>({});

  useEffect(() => {
    if (!project) return;
    const p = project as unknown as Record<string, unknown> & { settings?: Extra };
    setName((p.name as string) ?? "");
    const s = (p.settings as Extra) ?? {};
    setDescription(s.description ?? "");
    setLanguage((p.language as string) ?? "en");
    setAudience((p.target_age as string) ?? "");
    setAnimation((p.animation_style as string) ?? "");
    setVoice((p.voice_preference as string) ?? "");
    setPlatform((p.target_platform as string) ?? "");
    setProvider((p.preferred_ai_provider as string) ?? "qwen");
    setExtra(s);
  }, [project]);

  const save = useMutation({
    mutationFn: async () => updateProject(id, {
      name,
      language, target_age: audience, animation_style: animation,
      voice_preference: voice, target_platform: platform, preferred_ai_provider: provider,
      settings: { ...extra, description } as never,
    } as never),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["project", id] }); },
    onError: (e: unknown) => toast.error(formatDbError(e, "Save failed")),
  });

  const del = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => { toast.success("Project moved to trash"); navigate({ to: "/projects" }); },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="p-8">Project not found.</div>;

  const patch = (p: Partial<Extra>) => setExtra((e) => ({ ...e, ...p }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/projects/$id" params={{ id }} className="inline-flex items-center gap-1 hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Back to project</Link>
      </div>
      <PageHeader title="Project settings" description="Fine-tune generation defaults and manage this project." />

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Basics</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name"><Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" /></Field>
          <Field label="Default language">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{["en","es","fr","de","pt","hi","zh","ja","ar"].map((l) => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Description" full><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px] rounded-xl" /></Field>
          <Field label="Target audience"><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Kids 6-12" className="rounded-xl" /></Field>
          <Field label="Target platform">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{["YouTube","YouTube Shorts","TikTok","Instagram Reels","Website","Podcast"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Visual & voice defaults</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand colours (comma separated)"><Input value={extra.brandColors ?? ""} onChange={(e) => patch({ brandColors: e.target.value })} placeholder="#6366F1,#EC4899" className="rounded-xl" /></Field>
          <Field label="Default animation style">
            <Select value={animation} onValueChange={setAnimation}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{["Cinematic","Anime","Pixar 3D","Storybook","Watercolour","Cyberpunk","Documentary"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Default voice">
            <Select value={voice} onValueChange={setVoice}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{["Warm Narrator","Bright Female","Deep Male","Storyteller","Documentary"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Thumbnail style">
            <Select value={extra.thumbnailStyle ?? ""} onValueChange={(v) => patch({ thumbnailStyle: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{["Bold","Minimal","Illustrated","Cinematic","YouTube Face"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Default aspect ratio">
            <Select value={extra.aspectRatio ?? "16:9"} onValueChange={(v) => patch({ aspectRatio: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{["16:9","9:16","1:1","4:5","21:9"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Default resolution">
            <Select value={extra.resolution ?? "1080p"} onValueChange={(v) => patch({ resolution: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{["480p","720p","1080p","2k","4k"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">AI</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred AI provider">
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{["qwen","openai","wan","happy-horse"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={`Creativity: ${((extra.creativity ?? 0.6) * 100).toFixed(0)}%`}>
            <Slider value={[(extra.creativity ?? 0.6) * 100]} onValueChange={(v) => patch({ creativity: v[0] / 100 })} />
          </Field>
          <Field label="Autosave every">
            <Select value={String(extra.autosaveSeconds ?? 2)} onValueChange={(v) => patch({ autosaveSeconds: Number(v) })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,5,10,30].map((v) => <SelectItem key={v} value={String(v)}>{v} seconds</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Export preferences (comma separated)">
            <Input value={(extra.exportPreferences ?? []).join(",")} onChange={(e) => patch({ exportPreferences: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="pdf,docx,zip" className="rounded-xl" />
          </Field>
        </div>
      </Card>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-4 font-semibold">Sharing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collaboration">
            <Select value={extra.collaboration ?? "private"} onValueChange={(v) => patch({ collaboration: v as Extra["collaboration"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="team">Team</SelectItem><SelectItem value="public">Public</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Visibility">
            <Select value={extra.visibility ?? "private"} onValueChange={(v) => patch({ visibility: v as Extra["visibility"] })}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="unlisted">Unlisted</SelectItem><SelectItem value="public">Public</SelectItem></SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="rounded-xl text-destructive hover:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete project</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete this project?</AlertDialogTitle><AlertDialogDescription>It will be moved to Trash and restorable for 30 days.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save settings
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/projects/new")({
  head: () => ({ meta: [{ title: "New project — StorySpark AI" }] }),
  component: NewProjectPage,
});

const animationStyles = ["Watercolor", "Claymation", "Pixar-style 3D", "Flat 2D", "Cut-paper", "Anime", "Hand-drawn", "Stop-motion"];
const languages = ["English", "Spanish", "Portuguese", "French", "German", "Hindi", "Mandarin", "Arabic"];
const ageRanges = ["2–4", "3–5", "4–6", "5–7", "6–8", "8–10"];

function NewProjectPage() {
  const navigate = useNavigate();
  const [duration, setDuration] = useState([5]);
  const [form, setForm] = useState({
    name: "",
    age: "5–7",
    language: "English",
    topic: "",
    style: "Watercolor",
    objective: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: POST to /api/projects (Qwen-backed generation pipeline)
    toast.success("Project queued — generation will begin shortly.");
    navigate({ to: "/projects" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Create a new project"
        description="Tell us about the story — we'll handle script, voice, art and music."
      />

      <Card className="glass rounded-3xl p-8 shadow-soft">
        <form className="space-y-6" onSubmit={onSubmit}>
          <Field label="Project name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Lila & the Friendly Star"
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

          <Field label="Educational topic">
            <Input
              required
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g. The water cycle, multiplication, kindness…"
              className="rounded-xl"
            />
          </Field>

          <Field label={`Video duration — ${duration[0]} min`}>
            <Slider min={1} max={15} step={1} value={duration} onValueChange={setDuration} className="py-3" />
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

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/projects" })} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl gradient-primary text-white shadow-glow hover:opacity-95">
              <Sparkles className="mr-2 h-4 w-4" /> Generate Project
            </Button>
          </div>
        </form>
      </Card>
    </div>
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

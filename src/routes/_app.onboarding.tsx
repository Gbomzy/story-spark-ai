import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatDbError } from "@/lib/dbError";

export const Route = createFileRoute("/_app/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — StorySpark AI" }] }),
  component: OnboardingPage,
});

const USE_CASES = ["YouTube","TikTok","Instagram","Facebook","Kids Stories","Bible Stories","Education","Marketing","Podcasts"];
const ART_STYLES = ["Watercolor storybook","3D Pixar-style","Anime","Flat vector","Cinematic photo","Comic book"];
const VOICES = ["Warm female","Deep male","Playful child-friendly","Documentary narrator","Teacher voice"];
const LANGUAGES = ["English","Spanish","French","German","Portuguese","Arabic","Chinese","Hindi"];
const RATIOS: Array<"16:9"|"9:16"|"1:1"|"4:5"> = ["16:9","9:16","1:1","4:5"];

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [useCase, setUseCase] = useState("");
  const [artStyle, setArtStyle] = useState("");
  const [voice, setVoice] = useState("");
  const [language, setLanguage] = useState("English");
  const [ratio, setRatio] = useState<typeof RATIOS[number]>("16:9");

  const finish = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          onboarding: {
            completed: true,
            useCase, artStyle, voice, language, aspectRatio: ratio,
            completedAt: new Date().toISOString(),
          },
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Welcome to StorySpark AI");
      navigate({ to: "/create-movie" });
    },
    onError: (e) => toast.error(formatDbError(e)),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Welcome to StorySpark AI" description={`Step ${step} of 6`} />
      <Card className="space-y-6 p-6">
        {step === 1 && <ChoiceGrid title="What do you want to create?" options={USE_CASES} value={useCase} onChange={setUseCase} />}
        {step === 2 && <ChoiceGrid title="Choose your art style" options={ART_STYLES} value={artStyle} onChange={setArtStyle} />}
        {step === 3 && <ChoiceGrid title="Pick a narration voice" options={VOICES} value={voice} onChange={setVoice} />}
        {step === 4 && <ChoiceGrid title="Primary language" options={LANGUAGES} value={language} onChange={setLanguage} />}
        {step === 5 && <ChoiceGrid title="Preferred video format" options={RATIOS as unknown as string[]} value={ratio} onChange={(v) => setRatio(v as typeof RATIOS[number])} />}
        {step === 6 && (
          <div className="space-y-3">
            <div className="text-lg font-semibold">You're all set</div>
            <div className="text-sm text-muted-foreground">We'll use these defaults for every new project — you can change them anytime in Settings.</div>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              <li><span className="text-muted-foreground">Use case:</span> {useCase || "—"}</li>
              <li><span className="text-muted-foreground">Art style:</span> {artStyle || "—"}</li>
              <li><span className="text-muted-foreground">Voice:</span> {voice || "—"}</li>
              <li><span className="text-muted-foreground">Language:</span> {language}</li>
              <li><span className="text-muted-foreground">Format:</span> {ratio}</li>
            </ul>
          </div>
        )}
        <div className="flex justify-between">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>Back</Button>
          {step < 6 ? (
            <Button onClick={() => setStep((s) => Math.min(6, s + 1))}>Continue</Button>
          ) : (
            <Button disabled={finish.isPending} onClick={() => finish.mutate()} className="gradient-primary">
              {finish.isPending ? "Saving…" : "Create my first project"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function ChoiceGrid({ title, options, value, onChange }: { title: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-3 text-lg font-semibold">{title}</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-xl border p-3 text-left text-sm hover:bg-muted/50 ${value === o ? "border-primary bg-primary/5" : ""}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
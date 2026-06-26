import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PlaceholderSection } from "@/components/placeholder-section";
import { Mic } from "lucide-react";

export const Route = createFileRoute("/_app/voice-generator")({
  head: () => ({ meta: [{ title: "Voice Generator — StorySpark AI" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Voice Generator" description="Natural narrator and character voices in any language." />
      <PlaceholderSection icon={Mic} title="Voice synthesis" description="Pick a narrator, assign character voices and adjust emotion. Hook up to your preferred TTS provider here." />
    </div>
  ),
});

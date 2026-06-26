import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PlaceholderSection } from "@/components/placeholder-section";
import { Film } from "lucide-react";

export const Route = createFileRoute("/_app/storyboard")({
  head: () => ({ meta: [{ title: "Storyboard — StorySpark AI" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Storyboard" description="Scene-by-scene visual planning, generated from your script." />
      <PlaceholderSection icon={Film} title="Visual storyboards" description="Auto-generated panels with shot type, camera move and characters. Connect the Qwen vision API to render real scenes." />
    </div>
  ),
});

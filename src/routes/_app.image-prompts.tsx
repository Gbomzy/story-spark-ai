import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PlaceholderSection } from "@/components/placeholder-section";
import { ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_app/image-prompts")({
  head: () => ({ meta: [{ title: "Image Prompts — StorySpark AI" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Image Prompts" description="Reusable prompt templates for consistent characters and scenes." />
      <PlaceholderSection icon={ImageIcon} title="Prompt library" description="Save, tag and remix prompts. Plug in your image model of choice to preview results inline." />
    </div>
  ),
});

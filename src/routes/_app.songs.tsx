import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PlaceholderSection } from "@/components/placeholder-section";
import { Music } from "lucide-react";

export const Route = createFileRoute("/_app/songs")({
  head: () => ({ meta: [{ title: "Songs — StorySpark AI" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Songs" description="Original jingles, lullabies and theme songs for your stories." />
      <PlaceholderSection icon={Music} title="Composer studio" description="Describe a mood and tempo — we'll write the song, the lyrics and the stems." />
    </div>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PlaceholderSection } from "@/components/placeholder-section";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_app/seo-studio")({
  head: () => ({ meta: [{ title: "SEO Studio — StorySpark AI" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="SEO Studio" description="Titles, descriptions and tags optimized for kid-safe platforms." />
      <PlaceholderSection icon={Search} title="SEO optimizer" description="Generate platform-aware metadata for YouTube Kids, TikTok Family and more." />
    </div>
  ),
});

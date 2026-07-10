import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Youtube, Music2, Instagram, Facebook, Twitter, Linkedin, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_app/publishing")({
  head: () => ({ meta: [{ title: "Publishing Center — StorySpark AI" }] }),
  component: PublishingPage,
});

const CHANNELS = [
  { id: "youtube", label: "YouTube", icon: Youtube, format: "MP4 + thumbnail + description", specs: "1920×1080, ≤15 min recommended", ready: false },
  { id: "tiktok", label: "TikTok", icon: Music2, format: "9:16 MP4", specs: "1080×1920, ≤3 min", ready: false },
  { id: "reels", label: "Instagram Reels", icon: Instagram, format: "9:16 MP4", specs: "1080×1920, ≤90s", ready: false },
  { id: "facebook", label: "Facebook", icon: Facebook, format: "MP4", specs: "1280×720+, ≤4 GB", ready: false },
  { id: "x", label: "X", icon: Twitter, format: "MP4 + caption", specs: "≤2:20, 1280×720", ready: false },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, format: "MP4 + article copy", specs: "1920×1080, ≤10 min", ready: false },
  { id: "pinterest", label: "Pinterest", icon: ImageIcon, format: "Idea pin / MP4", specs: "1000×1500, ≤60s", ready: false },
];

function PublishingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Publishing Center"
        description="Export production-ready assets for every major platform. Direct publishing APIs unlock when their connectors are configured; downloadable assets are always available."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.id} className="glass rounded-3xl p-5 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary shadow-glow">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{c.label}</h3>
                    <p className="text-xs text-muted-foreground">{c.format}</p>
                  </div>
                </div>
                <Badge variant={c.ready ? "default" : "secondary"}>{c.ready ? "Connected" : "Download"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.specs}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Use the project's <span className="font-medium">Export</span> page or the Movie Studio's "Download package" to get the assets sized for {c.label}.
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
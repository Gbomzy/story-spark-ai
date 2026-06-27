import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Sparkles, Lock } from "lucide-react";
import { imageService } from "@/lib/imageService";

export function SceneImagesPanel({ imagesText }: { imagesText: string }) {
  const scenes = imageService.parseScenes(imagesText);
  const configured = imageService.isConfigured();

  if (scenes.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        <ImageIcon className="mb-2 h-6 w-6 opacity-60" />
        Generate image prompts first — one card per scene will appear here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {scenes.map((scene) => (
        <Card key={scene.sceneId} className="glass overflow-hidden rounded-2xl p-0 shadow-soft">
          <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-primary/10 via-muted/40 to-accent/10">
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <div className="flex flex-col items-center gap-1.5">
                <ImageIcon className="h-7 w-7 opacity-50" />
                <span className="text-[11px] uppercase tracking-wider">Image placeholder</span>
              </div>
            </div>
            <Badge className="absolute left-2 top-2 rounded-full bg-amber-500/15 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Coming soon
            </Badge>
          </div>
          <div className="space-y-3 p-4">
            <h4 className="line-clamp-1 text-sm font-semibold">{scene.title}</h4>
            <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {scene.prompt}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={!configured}
              className="w-full rounded-lg gradient-primary text-white shadow-glow hover:opacity-95 disabled:opacity-60"
            >
              {configured ? (
                <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate image</>
              ) : (
                <><Lock className="mr-1.5 h-3.5 w-3.5" /> Connect a provider</>
              )}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

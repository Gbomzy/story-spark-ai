import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Sparkles, Loader2, RefreshCw, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { imageService } from "@/lib/imageService";

type SceneState = {
  status: "idle" | "generating" | "ready" | "error";
  url?: string;
  provider?: string;
  durationMs?: number;
  creditsUsed?: number;
  error?: string;
};

export function SceneImagesPanel({
  imagesText,
  projectId,
}: {
  imagesText: string;
  projectId?: string;
}) {
  const scenes = imageService.parseScenes(imagesText);
  const configured = imageService.isConfigured();
  const [state, setState] = useState<Record<string, SceneState>>({});
  const [batchRunning, setBatchRunning] = useState(false);

  async function generateOne(scene: { sceneId: string; title: string; prompt: string }) {
    setState((s) => ({ ...s, [scene.sceneId]: { status: "generating" } }));
    try {
      const r = await imageService.generateForScene({ ...scene, projectId });
      setState((s) => ({
        ...s,
        [scene.sceneId]: {
          status: "ready",
          url: r.url,
          provider: r.provider,
          durationMs: r.durationMs,
          creditsUsed: r.creditsUsed,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate image";
      setState((s) => ({ ...s, [scene.sceneId]: { status: "error", error: msg } }));
      toast.error(msg);
    }
  }

  async function generateAll() {
    setBatchRunning(true);
    try {
      for (const s of scenes) {
        // eslint-disable-next-line no-await-in-loop
        await generateOne(s);
      }
    } finally {
      setBatchRunning(false);
    }
  }

  function download(scene: { sceneId: string; title: string }, url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scene.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (scenes.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        <ImageIcon className="mb-2 h-6 w-6 opacity-60" />
        Generate image prompts first — one card per scene will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            {scenes.length} scene{scenes.length === 1 ? "" : "s"} · Lovable AI · Gemini Image
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!configured || batchRunning}
          onClick={generateAll}
          className="rounded-lg gradient-primary text-white shadow-glow hover:opacity-95 disabled:opacity-60"
        >
          {batchRunning ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating all…</>
          ) : (
            <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate all scenes</>
          )}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {scenes.map((scene) => {
          const st = state[scene.sceneId] ?? { status: "idle" as const };
          return (
            <Card key={scene.sceneId} className="glass overflow-hidden rounded-2xl p-0 shadow-soft">
              <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-primary/10 via-muted/40 to-accent/10">
                {st.status === "ready" && st.url ? (
                  <img src={st.url} alt={scene.title} className="absolute inset-0 h-full w-full object-cover" />
                ) : st.status === "generating" ? (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-1.5">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <span className="text-[11px] uppercase tracking-wider">Rendering…</span>
                    </div>
                  </div>
                ) : st.status === "error" ? (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-1.5 px-4 text-center">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                      <span className="line-clamp-3 text-[11px]">{st.error}</span>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-1.5">
                      <ImageIcon className="h-7 w-7 opacity-50" />
                      <span className="text-[11px] uppercase tracking-wider">Ready to render</span>
                    </div>
                  </div>
                )}
                {st.status === "ready" && (
                  <Badge className="absolute left-2 top-2 rounded-full bg-emerald-500/15 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Ready
                  </Badge>
                )}
              </div>
              <div className="space-y-3 p-4">
                <h4 className="line-clamp-1 text-sm font-semibold">{scene.title}</h4>
                <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {scene.prompt}
                </p>
                {st.status === "ready" && (
                  <p className="text-[10px] text-muted-foreground">
                    {st.provider} · {(st.durationMs ?? 0)}ms
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!configured || st.status === "generating" || batchRunning}
                    onClick={() => generateOne(scene)}
                    className="flex-1 rounded-lg gradient-primary text-white shadow-glow hover:opacity-95 disabled:opacity-60"
                  >
                    {st.status === "generating" ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Rendering…</>
                    ) : st.status === "ready" ? (
                      <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate</>
                    ) : (
                      <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate</>
                    )}
                  </Button>
                  {st.status === "ready" && st.url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => download(scene, st.url!)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

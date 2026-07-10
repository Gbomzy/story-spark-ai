// Image generation service.
//
// Wired to the Lovable AI Gateway via the /api/generate-image server route.
// The orchestrator (src/lib/orchestrator.ts) owns the actual routing and
// metrics; this module keeps the parse helpers and the "isConfigured" flag
// so the UI can gate buttons consistently.

import { generateQwenImage } from "@/lib/qwenImage.functions";

export type SceneImage = {
  sceneId: string;
  title: string;
  prompt: string;
  url?: string | null;
  status: "idle" | "queued" | "generating" | "ready" | "error";
  error?: string;
};

export const imageService = {
  isConfigured(): boolean {
    // Wired to DashScope (Qwen Image 2.0 / Wan T2I). The server function
    // reads DASHSCOPE_API_KEY / QWEN_API_KEY at call time; UI is enabled.
    return true;
  },
  async generateForScene(scene: { title: string; prompt: string; sceneId?: string; projectId?: string; negativePrompt?: string; aspect?: string; seed?: number }): Promise<{ url: string; provider: string; durationMs: number; creditsUsed: number }> {
    return generateQwenImage({ data: { prompt: scene.prompt, sceneId: scene.sceneId, projectId: scene.projectId, negativePrompt: scene.negativePrompt, aspect: scene.aspect, seed: scene.seed } });
  },
  async generateAll(scenes: Array<{ title: string; prompt: string; sceneId?: string; projectId?: string; aspect?: string }>): Promise<SceneImage[]> {
    const out: SceneImage[] = [];
    for (const s of scenes) {
      try {
        const r = await generateQwenImage({ data: { prompt: s.prompt, sceneId: s.sceneId, projectId: s.projectId, aspect: s.aspect } });
        out.push({ sceneId: s.sceneId ?? s.title, title: s.title, prompt: s.prompt, url: r.url, status: "ready" });
      } catch (err) {
        out.push({ sceneId: s.sceneId ?? s.title, title: s.title, prompt: s.prompt, status: "error", error: err instanceof Error ? err.message : String(err) });
      }
    }
    return out;
  },
  /** Parse the markdown produced by the Qwen image-prompts agent into scenes. */
  parseScenes(images: string | null | undefined): Array<{ sceneId: string; title: string; prompt: string }> {
    if (!images) return [];
    const text = images.trim();
    if (!text) return [];
    // Split on lines that look like "Scene 1", "### Scene 2 - Title", "**Scene 3**", etc.
    const parts = text.split(/\n(?=\s*(?:#{1,4}\s*)?(?:\*\*)?\s*Scene\s+\d+)/i);
    const scenes: Array<{ sceneId: string; title: string; prompt: string }> = [];
    parts.forEach((chunk, i) => {
      const trimmed = chunk.trim();
      if (!trimmed) return;
      const firstLine = trimmed.split("\n")[0].replace(/[#*]/g, "").trim();
      const body = trimmed.split("\n").slice(1).join("\n").trim() || trimmed;
      const title = /^scene\s+\d+/i.test(firstLine) ? firstLine : `Scene ${i + 1}`;
      scenes.push({ sceneId: `scene-${i + 1}`, title, prompt: body });
    });
    if (scenes.length === 0) {
      scenes.push({ sceneId: "scene-1", title: "Scene 1", prompt: text });
    }
    return scenes;
  },
};

// Image generation service. Stub — no provider connected yet.
// Future: wire to an image provider (e.g. Qwen-VL, Flux, etc.) and persist
// generated URLs back onto projects.image_assets.

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
    return false;
  },
  async generateForScene(_scene: { title: string; prompt: string }): Promise<{ url: string }> {
    throw new Error("Image provider not connected yet.");
  },
  async generateAll(_scenes: Array<{ title: string; prompt: string }>): Promise<SceneImage[]> {
    throw new Error("Image provider not connected yet.");
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

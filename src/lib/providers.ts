// AI provider registry.
export type ProviderStatus = "connected" | "not_connected" | "api_ready" | "coming_soon";
export type ProviderCapability = "text" | "images" | "voice" | "music" | "video" | "subtitles";

export type ProviderDef = {
  id: string;
  name: string;
  vendor: string;
  capabilities: ProviderCapability[];
  status: ProviderStatus;
  description: string;
};

export const PROVIDERS: ProviderDef[] = [
  { id: "qwen", name: "Qwen", vendor: "Alibaba Cloud", capabilities: ["text"], status: "connected", description: "Story, characters, storyboard, voice script, songs, image prompts and SEO generation." },
  { id: "qwen-image", name: "Qwen Image", vendor: "Alibaba Cloud", capabilities: ["images"], status: "coming_soon", description: "Scene image generation — unavailable with current Qwen capabilities." },
  { id: "qwen-voice", name: "Qwen Voice", vendor: "Alibaba Cloud", capabilities: ["voice"], status: "coming_soon", description: "Narration synthesis — unavailable with current Qwen capabilities." },
  { id: "wan", name: "Wan AI", vendor: "Alibaba Cloud", capabilities: ["video"], status: "coming_soon", description: "Full animated video generation from images, narration and music." },
];

export function providerLabel(status: ProviderStatus): string {
  switch (status) {
    case "connected": return "Connected";
    case "not_connected": return "Not Connected";
    case "api_ready": return "API Ready";
    case "coming_soon": return "Coming Soon";
  }
}
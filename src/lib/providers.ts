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
  { id: "wan", name: "Wan AI", vendor: "Alibaba Cloud", capabilities: ["video"], status: "api_ready", description: "Full animated video generation from images, narration and music." },
  { id: "happy-horse", name: "Happy Horse", vendor: "Happy Horse", capabilities: ["video"], status: "coming_soon", description: "Alternative animation renderer for stylised children's videos." },
  { id: "openai", name: "OpenAI", vendor: "OpenAI", capabilities: ["text", "images", "voice"], status: "coming_soon", description: "Fallback text, image and TTS provider." },
  { id: "flux", name: "Flux", vendor: "Black Forest Labs", capabilities: ["images"], status: "coming_soon", description: "High-fidelity scene image generation." },
  { id: "elevenlabs", name: "ElevenLabs", vendor: "ElevenLabs", capabilities: ["voice"], status: "coming_soon", description: "Studio-grade narration voices." },
];

export function providerLabel(status: ProviderStatus): string {
  switch (status) {
    case "connected": return "Connected";
    case "not_connected": return "Not Connected";
    case "api_ready": return "API Ready";
    case "coming_soon": return "Coming Soon";
  }
}
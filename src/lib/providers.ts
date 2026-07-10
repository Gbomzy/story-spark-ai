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
  { id: "qwen-max", name: "Qwen-Max", vendor: "Alibaba Cloud", capabilities: ["text"], status: "connected", description: "Highest-capability Qwen reasoning model." },
  { id: "qwen-plus", name: "Qwen-Plus", vendor: "Alibaba Cloud", capabilities: ["text"], status: "connected", description: "Balanced Qwen model — default for pipeline text stages." },
  { id: "qwen-flash", name: "Qwen-Flash", vendor: "Alibaba Cloud", capabilities: ["text"], status: "connected", description: "Fast, low-latency Qwen model." },
  { id: "qwen-omni", name: "Qwen Omni", vendor: "Alibaba Cloud", capabilities: ["text", "voice"], status: "api_ready", description: "Multimodal Qwen (text, audio)." },
  { id: "qwen-vl", name: "Qwen VL", vendor: "Alibaba Cloud", capabilities: ["text"], status: "api_ready", description: "Vision-language Qwen for image understanding." },
  { id: "qwen-image", name: "Qwen Image 2.0", vendor: "Alibaba Cloud", capabilities: ["images"], status: "connected", description: "Qwen Image 2.0 (`qwen-image-2.0`) via DashScope multimodal generation." },
  { id: "wan-t2i", name: "Wan Text-to-Image", vendor: "Alibaba Cloud", capabilities: ["images"], status: "connected", description: "Legacy provider slot; image generation now routes to Qwen Image 2.0." },
  { id: "wan-t2v", name: "Wan Text-to-Video", vendor: "Alibaba Cloud", capabilities: ["video"], status: "connected", description: "Wan 2.7 text-to-video via DashScope video-synthesis." },
  { id: "wan-i2v", name: "Wan Image-to-Video", vendor: "Alibaba Cloud", capabilities: ["video"], status: "connected", description: "Wan 2.7 image-to-video via DashScope video-synthesis." },
  { id: "wan-ref2v", name: "Wan Reference-to-Video", vendor: "Alibaba Cloud", capabilities: ["video"], status: "connected", description: "Wan 2.7 reference-guided video generation." },
  { id: "wan-edit", name: "Wan Video Edit", vendor: "Alibaba Cloud", capabilities: ["video"], status: "connected", description: "Wan 2.7 video editing." },
  { id: "cosyvoice", name: "CosyVoice", vendor: "Alibaba Cloud", capabilities: ["voice"], status: "connected", description: "Voice provider slot routed to Qwen3-TTS Flash." },
  { id: "qwen-tts", name: "Qwen TTS", vendor: "Alibaba Cloud", capabilities: ["voice"], status: "connected", description: "Qwen3-TTS Flash via DashScope multimodal generation." },
  { id: "fun-asr", name: "Fun-ASR", vendor: "Alibaba Cloud", capabilities: ["subtitles"], status: "connected", description: "Fun-ASR (`fun-asr`) speech recognition with sentence timestamps." },
  { id: "qwen-asr", name: "Qwen ASR", vendor: "Alibaba Cloud", capabilities: ["subtitles"], status: "connected", description: "Qwen speech recognition via DashScope." },
  { id: "qwen-ocr", name: "Qwen OCR", vendor: "Alibaba Cloud", capabilities: ["text"], status: "connected", description: "Qwen OCR — extract text from images, comics, PDFs." },
  { id: "qwen-translate", name: "Qwen Translation", vendor: "Alibaba Cloud", capabilities: ["text"], status: "connected", description: "Qwen translation across dozens of languages." },
];

export function providerLabel(status: ProviderStatus): string {
  switch (status) {
    case "connected": return "Connected";
    case "not_connected": return "Not Connected";
    case "api_ready": return "API Ready";
    case "coming_soon": return "Coming Soon";
  }
}
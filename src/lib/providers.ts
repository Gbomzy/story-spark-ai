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
  { id: "qwen-image", name: "Qwen Image 2.0", vendor: "Alibaba Cloud", capabilities: ["images"], status: "connected", description: "DashScope wan2.2 / wanx2.1 text-to-image." },
  { id: "wan-t2i", name: "Wan Text-to-Image", vendor: "Alibaba Cloud", capabilities: ["images"], status: "connected", description: "Wan T2I via DashScope image-synthesis." },
  { id: "wan-t2v", name: "Wan Text-to-Video", vendor: "Alibaba Cloud", capabilities: ["video"], status: "api_ready", description: "Wan text-to-video (rolling out in next slice)." },
  { id: "wan-i2v", name: "Wan Image-to-Video", vendor: "Alibaba Cloud", capabilities: ["video"], status: "api_ready", description: "Wan image-to-video (rolling out in next slice)." },
  { id: "wan-ref2v", name: "Wan Reference-to-Video", vendor: "Alibaba Cloud", capabilities: ["video"], status: "api_ready", description: "Wan reference-guided video (rolling out in next slice)." },
  { id: "wan-edit", name: "Wan Video Edit", vendor: "Alibaba Cloud", capabilities: ["video"], status: "api_ready", description: "Wan video editing (rolling out in next slice)." },
  { id: "cosyvoice", name: "CosyVoice", vendor: "Alibaba Cloud", capabilities: ["voice"], status: "api_ready", description: "CosyVoice TTS via DashScope (rolling out in next slice)." },
  { id: "qwen-tts", name: "Qwen TTS", vendor: "Alibaba Cloud", capabilities: ["voice"], status: "api_ready", description: "Qwen text-to-speech (rolling out in next slice)." },
  { id: "fun-asr", name: "Fun-ASR", vendor: "Alibaba Cloud", capabilities: ["subtitles"], status: "api_ready", description: "Fun-ASR speech recognition (rolling out in next slice)." },
  { id: "qwen-asr", name: "Qwen ASR", vendor: "Alibaba Cloud", capabilities: ["subtitles"], status: "api_ready", description: "Qwen speech recognition (rolling out in next slice)." },
  { id: "qwen-ocr", name: "Qwen OCR", vendor: "Alibaba Cloud", capabilities: ["text"], status: "api_ready", description: "Qwen OCR — extract text from images, comics, PDFs." },
  { id: "qwen-translate", name: "Qwen Translation", vendor: "Alibaba Cloud", capabilities: ["text"], status: "api_ready", description: "Qwen translation across dozens of languages." },
];

export function providerLabel(status: ProviderStatus): string {
  switch (status) {
    case "connected": return "Connected";
    case "not_connected": return "Not Connected";
    case "api_ready": return "API Ready";
    case "coming_soon": return "Coming Soon";
  }
}
// Voice / narration service. Alias of audioService for the new naming used in
// Phase 2B (voiceService). Kept as a thin re-export so existing audioService
// call sites continue to work unchanged.
export { audioService as voiceService, type AudioAsset as VoiceAsset } from "./audioService";
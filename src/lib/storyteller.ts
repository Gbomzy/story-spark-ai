// Smart Storyteller layer.
//
// Analyses a scene's narration text (plus its BGM mood, if known) and
// derives expressive voice parameters — speaking rate, pitch, style tag,
// natural pauses — that the TTS provider can apply. Produces three
// parallel outputs so any downstream engine can consume what it supports:
//
//   • `voiceParams`   — plain numeric knobs (speed / pitch / voice preset)
//                       forwarded to CosyVoice / Qwen TTS.
//   • `instructions`  — natural-language steering string usable by
//                       providers like OpenAI's gpt-4o-mini-tts.
//   • `ssml`          — SSML wrapping <break>, <prosody> and <emphasis>
//                       markup for providers that support SSML input.
//
// The module is pure and client-safe — no network, no side effects.

import type { BgmMood } from "@/lib/storyMusic";
import { sanitizeVoiceScript } from "@/lib/voiceScript";

export type StorytellerEmotion =
  | "neutral"
  | "happy"
  | "sad"
  | "excited"
  | "adventure"
  | "suspense"
  | "calm"
  | "bedtime"
  | "surprise"
  | "curious"
  | "whisper"
  | "encouraging"
  | "playful";

export type StorytellerStyle = {
  emotion: StorytellerEmotion;
  /** Detected dialogue vs. narration content ratio in [0, 1]. */
  dialogueRatio: number;
  /** Overall excitement score in [0, 1]. */
  excitement: number;
  /** Human summary of why these knobs were chosen. */
  reasoning: string;
};

export type StorytellerVoiceParams = {
  /** Recommended CosyVoice preset (one of the qwen3-tts-flash voices). */
  voice: "Cherry" | "Serena" | "Ethan" | "Chelsie" | "Dylan" | "Jada" | "Sunny";
  /** 0.5 – 2.0 — 1.0 is neutral. */
  speed: number;
  /** 0.5 – 2.0 — 1.0 is neutral. */
  pitch: number;
  /** 0..1 — TTS output loudness target (post-mix). */
  volume: number;
};

export type StorytellerPlan = {
  style: StorytellerStyle;
  params: StorytellerVoiceParams;
  /** Natural-language steering for OpenAI-compatible TTS. */
  instructions: string;
  /** SSML string when the provider supports it. */
  ssml: string;
  /** Cleaned narration text ready for a TTS request. */
  spokenText: string;
};

// ---------- analysis ----------

const POSITIVE = /(laugh|smile|joy|happy|delight|celebra|cheer|hooray|yay|wonderful|amazing)/i;
const SAD = /(cry|tear|sad|lonely|sorrow|miss|goodbye|lost|hurt)/i;
const EXCITED = /(!{1,}|wow|amazing|incredible|fantastic|whoa|run|fast|leap|jump|explod)/i;
const SUSPENSE = /(suddenly|dark|shadow|whisper|silence|mystery|creep|slowly|beware|danger)/i;
const WHISPER = /(whisper|shh|quietly|hush)/i;
const CURIOUS = /(wonder|why|how come|maybe|perhaps|question|discover|search)/i;
const ENCOURAGE = /(you can|believe|try again|never give up|be brave|keep going)/i;

function countMatches(text: string, re: RegExp): number {
  const m = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
  return m ? m.length : 0;
}

function dialogueRatio(text: string): number {
  if (!text) return 0;
  const words = Math.max(1, text.split(/\s+/).length);
  // Any word that appears between straight or curly quotes.
  const inQuotes = text.match(/["“][^"”]{1,300}["”]/g) ?? [];
  const quoted = inQuotes.reduce((n, s) => n + s.split(/\s+/).length, 0);
  return Math.min(1, quoted / words);
}

function excitementScore(text: string): number {
  if (!text) return 0;
  const excl = (text.match(/!/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const caps = (text.match(/\b[A-Z]{3,}\b/g) ?? []).length;
  const cues = countMatches(text, EXCITED);
  const norm = Math.min(1, (excl * 2 + cues * 2 + caps + questions * 0.5) / 20);
  return norm;
}

function pickEmotion(text: string, mood?: BgmMood): StorytellerEmotion {
  if (WHISPER.test(text)) return "whisper";
  if (ENCOURAGE.test(text)) return "encouraging";
  if (SUSPENSE.test(text)) return "suspense";
  if (SAD.test(text)) return "sad";
  if (POSITIVE.test(text) && EXCITED.test(text)) return "excited";
  if (CURIOUS.test(text)) return "curious";
  if (POSITIVE.test(text)) return "happy";
  switch (mood) {
    case "bedtime":
      return "bedtime";
    case "adventure":
      return "adventure";
    case "calm":
      return "calm";
    case "celebration":
      return "excited";
    case "mystery":
      return "suspense";
    case "emotional":
      return "sad";
    case "funny":
      return "playful";
    case "happy":
      return "happy";
  }
  return "neutral";
}

// ---------- voice-param preset per emotion ----------

const PRESETS: Record<StorytellerEmotion, Omit<StorytellerVoiceParams, "volume">> = {
  neutral: { voice: "Cherry", speed: 1.0, pitch: 1.0 },
  happy: { voice: "Cherry", speed: 1.08, pitch: 1.08 },
  playful: { voice: "Sunny", speed: 1.12, pitch: 1.1 },
  excited: { voice: "Sunny", speed: 1.18, pitch: 1.12 },
  adventure: { voice: "Ethan", speed: 1.12, pitch: 1.02 },
  suspense: { voice: "Serena", speed: 0.9, pitch: 0.95 },
  sad: { voice: "Serena", speed: 0.9, pitch: 0.92 },
  calm: { voice: "Chelsie", speed: 0.96, pitch: 1.0 },
  bedtime: { voice: "Chelsie", speed: 0.85, pitch: 0.95 },
  surprise: { voice: "Sunny", speed: 1.15, pitch: 1.15 },
  curious: { voice: "Cherry", speed: 1.02, pitch: 1.05 },
  whisper: { voice: "Serena", speed: 0.9, pitch: 0.9 },
  encouraging: { voice: "Jada", speed: 1.0, pitch: 1.05 },
};

const INSTRUCTIONS: Record<StorytellerEmotion, string> = {
  neutral: "Read as a warm, expressive storyteller for children. Natural cadence, clear articulation.",
  happy: "Bright, smiling storyteller voice. Slightly faster tempo, uplifted intonation.",
  playful: "Playful and mischievous. Bouncy rhythm, light laughter in the voice.",
  excited: "High energy. Faster pace and animated pitch, but stay clear and understandable.",
  adventure: "Bold, adventurous storyteller. Confident pace with dynamic phrasing.",
  suspense: "Slow and hushed. Dramatic pauses, quieter tone, build tension gradually.",
  sad: "Gentle, soft, empathetic. Slower delivery with a slight tremble on emotional beats.",
  calm: "Warm and calm bedtime narrator. Gentle prosody, unhurried.",
  bedtime: "Very soft, slow, and soothing lullaby-narrator voice. Whisper-adjacent.",
  surprise: "Add a small gasp of surprise. Rising intonation on key words.",
  curious: "Inquisitive, wondering tone. Light emphasis on questions.",
  whisper: "Whispered delivery. Quiet, breathy, close to the microphone.",
  encouraging: "Kind, uplifting mentor voice. Warm affirmations, steady tempo.",
};

// ---------- SSML ----------

function toSsml(text: string, emotion: StorytellerEmotion, params: StorytellerVoiceParams): string {
  const rate = `${Math.round(params.speed * 100)}%`;
  const pitch = params.pitch >= 1 ? `+${Math.round((params.pitch - 1) * 100)}%` : `${Math.round((params.pitch - 1) * 100)}%`;
  // Add small breaks after strong punctuation.
  const withBreaks = text
    .replace(/([.!?])\s+/g, '$1 <break time="350ms"/> ')
    .replace(/,\s+/g, ', <break time="120ms"/> ');
  const style = emotion === "whisper" ? ' volume="soft"' : emotion === "excited" ? ' volume="loud"' : "";
  return `<speak><prosody rate="${rate}" pitch="${pitch}"${style}>${withBreaks}</prosody></speak>`;
}

// ---------- public API ----------

export function analyzeScene(rawText: string, mood?: BgmMood): StorytellerStyle {
  const text = String(rawText ?? "");
  const emotion = pickEmotion(text, mood);
  const style: StorytellerStyle = {
    emotion,
    dialogueRatio: dialogueRatio(text),
    excitement: excitementScore(text),
    reasoning: buildReason(emotion, text, mood),
  };
  return style;
}

function buildReason(e: StorytellerEmotion, text: string, mood?: BgmMood): string {
  const parts: string[] = [];
  parts.push(`emotion=${e}`);
  if (mood) parts.push(`bgm=${mood}`);
  const d = dialogueRatio(text);
  if (d > 0.2) parts.push(`dialogue=${Math.round(d * 100)}%`);
  const x = excitementScore(text);
  if (x > 0.2) parts.push(`excitement=${Math.round(x * 100)}%`);
  return parts.join(", ");
}

export function planStoryteller(rawText: string, opts?: { mood?: BgmMood; volume?: number }): StorytellerPlan {
  const spokenText = sanitizeVoiceScript(rawText);
  const style = analyzeScene(spokenText, opts?.mood);
  const preset = PRESETS[style.emotion];
  // Nudge speed with excitement; dialogue slows slightly to breathe.
  const speed = clamp(preset.speed + style.excitement * 0.05 - style.dialogueRatio * 0.03, 0.5, 2);
  const pitch = clamp(preset.pitch, 0.5, 2);
  const params: StorytellerVoiceParams = {
    voice: preset.voice,
    speed: Number(speed.toFixed(2)),
    pitch: Number(pitch.toFixed(2)),
    volume: clamp(opts?.volume ?? 1, 0, 1),
  };
  return {
    style,
    params,
    instructions: INSTRUCTIONS[style.emotion],
    ssml: toSsml(spokenText, style.emotion, params),
    spokenText,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

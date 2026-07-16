// Narration sanitizer used both by the TTS server functions and the client UI
// so what the voice reads matches what the user hears in the audio player.
//
// The story generators output a screenplay-style script (`[NARRATOR]`, `[SFX:
// pages]`, `[MUSIC swells]`, `[PAUSE 1s]`, `Scene 3 — At the library`, etc.)
// meant to be edited by humans. The raw text should NEVER be sent to a
// text-to-speech engine — otherwise the voice literally reads "narrator",
// "s-f-x", scene numbers and stage directions.
//
// `sanitizeVoiceScript` returns the audiobook-ready version:
//  - Strip all bracketed cues: [NARRATOR], [CHARACTER NAME], [SFX ...],
//    [MUSIC ...], [CAMERA ...], [SCENE ...], [SHOT ...], [PAUSE 1s],
//    parenthetical stage directions like (whispering).
//  - Convert `[PAUSE Ns]` into a natural pause (`. `) — most Alibaba TTS
//    engines don't accept OpenAI-style SSML `<break>` tags, and a period
//    already yields a comparable prosodic pause. Callers that want SSML can
//    ask for it explicitly via `pauseFormat: "ssml"`.
//  - Drop headings ("## Scene 3 — At the library", "Chapter 2").
//  - Strip a leading `Character:` label so "Lila: Hi!" becomes "Hi!".
//  - Strip markdown emphasis so `*loved*` reads as `loved`.
//  - Collapse whitespace into a single-flow paragraph the TTS can pace.
//
// The original editable script is never mutated — only the string passed to
// the TTS provider is.

export type PauseFormat = "natural" | "ssml";

const CUE_TAGS = [
  "narrator",
  "character",
  "sfx",
  "music",
  "camera",
  "scene",
  "shot",
  "pause",
  "vo",
  "cut",
  "fade",
];

function stripBracketed(text: string, pauseFormat: PauseFormat): string {
  return text.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
    const raw = inner.trim();
    const lower = raw.toLowerCase();
    // [PAUSE 1s] / [PAUSE 500ms] → natural pause OR SSML break
    const pauseMatch = lower.match(/^pause\s*(\d+(?:\.\d+)?)\s*(ms|s)?/);
    if (pauseMatch) {
      if (pauseFormat === "ssml") {
        const value = pauseMatch[1];
        const unit = pauseMatch[2] === "ms" ? "ms" : "s";
        return ` <break time="${value}${unit}"/> `;
      }
      return ". ";
    }
    // Any tag whose head word is a known production cue → strip entirely.
    const head = lower.split(/[\s:.-]/)[0];
    if (CUE_TAGS.includes(head)) return " ";
    // Character labels like [Lila] or [MRS. OWL] → also drop.
    if (/^[A-Za-z][A-Za-z0-9 '.-]{0,40}$/.test(raw)) return " ";
    return " ";
  });
}

function stripParenDirections(text: string): string {
  // Only strip short parentheticals (stage directions like (warmly),
  // (whispering)). Preserve genuine parenthetical prose.
  return text.replace(/\(([^)]{1,40})\)/g, (m, inner: string) => {
    const t = inner.trim();
    // Directions are typically 1–3 lowercase words, sometimes ending in -ly.
    if (/^[a-z][a-z\s,'-]*$/.test(t) && t.split(/\s+/).length <= 4) return " ";
    return m;
  });
}

export function sanitizeVoiceScript(
  raw: string | null | undefined,
  opts: { pauseFormat?: PauseFormat } = {},
): string {
  if (!raw) return "";
  const pauseFormat: PauseFormat = opts.pauseFormat ?? "natural";
  const lines = String(raw).split(/\r?\n/);
  const out: string[] = [];
  for (const original of lines) {
    let l = original.trim();
    if (!l) { out.push(""); continue; }
    // Drop markdown headings and bullet markers.
    l = l.replace(/^#{1,6}\s+/, "").replace(/^[-*•]\s+/, "");
    // Drop scene / chapter / shot headings entirely.
    if (/^(scene|shot|act|chapter|part|int\.|ext\.)\b/i.test(l)) continue;
    // Strip leading "Narrator:" / "NARRATOR:" prefix (also with dash).
    l = l.replace(/^\s*narrator\s*[:\-]\s*/i, "");
    // Strip a leading "Character:" label (e.g. "Lila: Hello!").
    l = l.replace(/^\s*[A-Z][A-Za-z' .-]{0,30}\s*:\s+/, "");
    // Strip bracketed cues + short parenthetical stage directions.
    l = stripBracketed(l, pauseFormat);
    l = stripParenDirections(l);
    // Strip markdown emphasis markers but keep the words inside.
    l = l.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
    l = l.replace(/__([^_]+)__/g, "$1").replace(/_([^_]+)_/g, "$1");
    l = l.replace(/\s{2,}/g, " ").trim();
    if (l) out.push(l);
  }
  return out.join(" ").replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
}

// ---------- Expressive narration builder ----------
//
// Turns a sanitized narration into a more expressive read for CosyVoice /
// gpt-4o-mini-tts by:
//   - inserting natural micro-pauses after commas and stronger pauses
//     after sentences (encoded as extra whitespace + punctuation so any
//     TTS engine respects the prosody, not just SSML-capable ones)
//   - normalising exclamation runs ("!!!" → "!") so the voice doesn't
//     hard-clip on excitement
//   - collapsing ALL-CAPS shouting into title case so the TTS uses
//     emphasis, not a robotic letter-by-letter spelling
//
// This never re-introduces stage directions — it operates only on the
// already-sanitized spoken text.
export function expressiveVoiceScript(clean: string): string {
  if (!clean) return "";
  let t = clean;
  // Deflate exclamation/question runs but keep one for emphasis.
  t = t.replace(/([!?])\1{1,}/g, "$1");
  // ALL-CAPS words → sentence case so the voice speaks them naturally.
  t = t.replace(/\b([A-Z]{4,})\b/g, (_, w: string) => w.charAt(0) + w.slice(1).toLowerCase());
  // Slight breathing pause after every sentence terminator (double space
  // helps TTS engines that ignore SSML still hear the boundary).
  t = t.replace(/([.!?])\s+/g, "$1  ");
  // Micro-pause after commas / semicolons.
  t = t.replace(/([,;:])\s+/g, "$1 ");
  return t.replace(/\s{3,}/g, "  ").trim();
}

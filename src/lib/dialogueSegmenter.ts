// Dialogue Segmenter — split a narration script into ordered segments
// tagged as Narrator or a specific character. Prepares the pipeline for
// future multi-voice narration while keeping single-voice output working
// today (all segments concatenated → the same TTS input as before).

export type DialogueSegment = {
  speaker: string;           // "Narrator" or character name
  role: "narrator" | "character";
  text: string;
  emotion?: string;
  /** Suggested pause after this segment, in milliseconds. */
  pauseAfterMs: number;
};

const DIALOGUE_LINE_RE = /^\s*([A-Z][A-Za-z' .-]{0,30})\s*[:\-—]\s+(.+)$/;
const QUOTED_RE = /"([^"]{1,400})"|"([^"]{1,400})"/g;

function pauseFor(emotion?: string, endsWith?: string): number {
  if (endsWith === "?") return 400;
  if (endsWith === "!") return 250;
  switch (emotion) {
    case "suspense": return 900;
    case "sad":
    case "emotional": return 700;
    case "excited":
    case "happy": return 200;
    case "mystery": return 800;
    default: return 350;
  }
}

function detectEmotion(t: string): string | undefined {
  const s = t.toLowerCase();
  if (/[!]{1,}|wow|amazing|yay/.test(s)) return "excited";
  if (/cry|sad|tear|miss/.test(s)) return "sad";
  if (/whisper|shhh|quietly/.test(s)) return "whisper";
  if (/suddenly|shadow|dark|mystery/.test(s)) return "suspense";
  if (/\?$/.test(t.trim())) return "curious";
  return undefined;
}

export function segmentDialogue(rawScript: string): DialogueSegment[] {
  const out: DialogueSegment[] = [];
  if (!rawScript) return out;
  const lines = rawScript.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // "Name: dialogue"
    const m = line.match(DIALOGUE_LINE_RE);
    if (m) {
      const speaker = m[1].trim();
      const text = m[2].trim();
      if (/^narrator$/i.test(speaker)) {
        pushSegment(out, "Narrator", "narrator", text);
      } else {
        pushSegment(out, speaker, "character", text);
      }
      continue;
    }
    // Mixed narration with quoted speech
    const parts = splitByQuotes(line);
    if (parts.length > 1) {
      for (const p of parts) {
        if (p.quoted) pushSegment(out, "Character", "character", p.text);
        else pushSegment(out, "Narrator", "narrator", p.text);
      }
    } else {
      pushSegment(out, "Narrator", "narrator", line);
    }
  }
  return out;
}

function pushSegment(out: DialogueSegment[], speaker: string, role: "narrator" | "character", text: string) {
  const clean = text.trim();
  if (!clean) return;
  const emotion = detectEmotion(clean);
  const endsWith = clean.slice(-1);
  out.push({
    speaker,
    role,
    text: clean,
    emotion,
    pauseAfterMs: pauseFor(emotion, endsWith),
  });
}

function splitByQuotes(line: string): Array<{ text: string; quoted: boolean }> {
  const parts: Array<{ text: string; quoted: boolean }> = [];
  let last = 0;
  QUOTED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUOTED_RE.exec(line)) !== null) {
    const start = m.index;
    if (start > last) parts.push({ text: line.slice(last, start).trim(), quoted: false });
    parts.push({ text: (m[1] ?? m[2] ?? "").trim(), quoted: true });
    last = start + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last).trim(), quoted: false });
  return parts.filter((p) => p.text.length > 0);
}

/** Concatenate segments back into a single spoken script with SSML pauses. */
export function segmentsToSsml(segments: DialogueSegment[]): string {
  const inner = segments
    .map((s) => `${escapeXml(s.text)}<break time="${s.pauseAfterMs}ms"/>`)
    .join(" ");
  return `<speak>${inner}</speak>`;
}

/** Plain-text join for single-voice TTS today. */
export function segmentsToPlainScript(segments: DialogueSegment[]): string {
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Distinct non-narrator speakers, in first-appearance order. */
export function extractCastFromSegments(segments: DialogueSegment[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of segments) {
    if (s.role === "character" && s.speaker && !seen.has(s.speaker)) {
      seen.add(s.speaker); out.push(s.speaker);
    }
  }
  return out;
}
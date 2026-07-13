// Character Visual Memory — canonical per-character appearance profile.
// Persisted inside Story Bible as `visualProfiles[characterName]`.
// Every image, video, regeneration, and thumbnail should compose its
// prompt through `characterPromptFragment()` so appearance stays stable.

export type CharacterVisualProfile = {
  name: string;
  age?: string;
  gender?: string;
  height?: string;
  bodyShape?: string;
  skinTone?: string;
  hairStyle?: string;
  hairColor?: string;
  eyeColor?: string;
  faceShape?: string;
  clothing?: string;
  shoes?: string;
  accessories?: string;
  expressions?: string;
  personality?: string;
  walkingStyle?: string;
  voiceStyle?: string;
  /** Deterministic seed for image gen (stable across regenerations). */
  seed?: number;
};

export type VisualProfileMap = Record<string, CharacterVisualProfile>;

export function emptyVisualProfile(name: string): CharacterVisualProfile {
  return { name };
}

/** Extract a rough visual profile from a free-text "appearance" description.
 *  Heuristic — the AI Director / Story Bible generator should ideally
 *  populate structured fields, but this keeps legacy characters usable. */
export function inferVisualProfile(name: string, appearance?: string, personality?: string, voice?: string): CharacterVisualProfile {
  const text = (appearance ?? "").toLowerCase();
  const profile: CharacterVisualProfile = { name };
  const ageM = text.match(/(\d{1,2})\s*(?:year|yr)/); if (ageM) profile.age = `${ageM[1]} years old`;
  if (/\b(boy|girl|young|child|kid)\b/.test(text)) profile.age ??= "child";
  if (/\b(man|male|father|dad|king|prince|guy)\b/.test(text)) profile.gender = "male";
  else if (/\b(woman|female|mother|mom|queen|princess|lady|girl)\b/.test(text)) profile.gender = "female";
  const hairM = text.match(/(black|brown|blond[e]?|red|gray|grey|white|silver|golden)\s+hair/);
  if (hairM) profile.hairColor = hairM[1];
  const styleM = text.match(/(curly|straight|wavy|short|long|braided|ponytail|bun)\s+hair/);
  if (styleM) profile.hairStyle = styleM[1];
  const eyeM = text.match(/(blue|brown|green|hazel|gray|amber|black)\s+eyes/);
  if (eyeM) profile.eyeColor = eyeM[1];
  const skinM = text.match(/(fair|pale|olive|tan|dark|brown|light|medium)\s+skin/);
  if (skinM) profile.skinTone = skinM[1];
  profile.clothing = appearance?.trim() || undefined;
  profile.personality = personality?.trim() || undefined;
  profile.voiceStyle = voice?.trim() || undefined;
  profile.seed = fnv1a(name);
  return profile;
}

/** Produce a compact prompt fragment for image/video generators. */
export function characterPromptFragment(p: CharacterVisualProfile | undefined): string {
  if (!p) return "";
  const parts: string[] = [p.name];
  if (p.age) parts.push(p.age);
  if (p.gender) parts.push(p.gender);
  if (p.height) parts.push(p.height);
  if (p.bodyShape) parts.push(`${p.bodyShape} build`);
  if (p.skinTone) parts.push(`${p.skinTone} skin`);
  if (p.hairStyle || p.hairColor) parts.push(`${p.hairStyle ?? ""} ${p.hairColor ?? ""} hair`.trim());
  if (p.eyeColor) parts.push(`${p.eyeColor} eyes`);
  if (p.faceShape) parts.push(`${p.faceShape} face`);
  if (p.clothing) parts.push(`wearing ${p.clothing}`);
  if (p.shoes) parts.push(`with ${p.shoes}`);
  if (p.accessories) parts.push(`and ${p.accessories}`);
  if (p.expressions) parts.push(`expression: ${p.expressions}`);
  return parts.filter(Boolean).join(", ");
}

/** Compose prompts for all named characters in the scene. */
export function scenePromptWithCharacters(basePrompt: string, presentNames: string[], profiles: VisualProfileMap): string {
  const fragments = presentNames
    .map((n) => profiles[n])
    .filter((p): p is CharacterVisualProfile => !!p)
    .map((p) => characterPromptFragment(p));
  if (fragments.length === 0) return basePrompt;
  return `${basePrompt}\n\nCharacters (keep appearance identical in every shot): ${fragments.join(" | ")}.`;
}

function fnv1a(s: string): number {
  let h = 2166136261 >>> 0;
  const q = s.trim().toLowerCase();
  for (let i = 0; i < q.length; i++) { h ^= q.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h % 2147483647;
}
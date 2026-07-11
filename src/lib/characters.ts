// Character library used for visual consistency across generations.
//
// A character is a name + a short visual description + a deterministic seed
// derived from the name. Passing the seed to Qwen image generation, together
// with the same reference-sheet description, keeps the same character looking
// alike across every scene / project that uses that name.

export type Character = {
  id: string;
  name: string;
  trait: string;
  description: string; // reference sheet used as a prompt prefix
  color: string;
};

export const CHARACTER_PRESETS: Character[] = [
  {
    id: "lila",
    name: "Lila",
    trait: "Curious dreamer",
    description:
      "Lila, a 7-year-old girl with warm brown skin, wavy black hair in twin braids, bright hazel eyes, a small freckle under her right eye, wearing a mustard-yellow sweater, denim overalls and red sneakers.",
    color: "gradient-warm",
  },
  {
    id: "mango",
    name: "Mango",
    trait: "Brave explorer",
    description:
      "Mango, an 8-year-old boy with tan skin, messy sun-bleached brown hair, green eyes, a bandaid on his cheek, wearing a khaki explorer vest over a white tee, olive shorts and hiking boots.",
    color: "gradient-warm",
  },
  {
    id: "bubbles",
    name: "Bubbles",
    trait: "Gentle giant",
    description:
      "Bubbles, a plump friendly blue whale with soft rounded features, big kind eyes, tiny sparkles on his back, cartoon 3D style.",
    color: "gradient-cool",
  },
  {
    id: "pixie",
    name: "Pixie",
    trait: "Magical guide",
    description:
      "Pixie, a tiny fairy with pale lavender skin, silver pixie-cut hair, translucent iridescent wings, wearing a petal-dress, glowing softly.",
    color: "gradient-primary",
  },
  {
    id: "rusty",
    name: "Rusty",
    trait: "Recycling robot",
    description:
      "Rusty, a friendly round recycling robot painted mint green with copper rivets, one antenna with a leaf, cheerful LED eyes, boxy body on treads.",
    color: "gradient-primary",
  },
  {
    id: "captain-cabbage",
    name: "Captain Cabbage",
    trait: "Goofy hero",
    description:
      "Captain Cabbage, a cheerful humanoid cabbage superhero with leafy green skin, a red cape, tiny black boots, big cartoon eyes, wearing a golden 'C' emblem on his chest.",
    color: "gradient-cool",
  },
];

/** Deterministic 32-bit seed from a character name so the same name always
 *  yields the same seed (and therefore visually consistent generations). */
export function characterSeed(name: string): number {
  let h = 2166136261 >>> 0;
  const s = name.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Keep it under Wan/Qwen's typical seed range.
  return h % 2147483647;
}

export function findCharacter(nameOrId: string | null | undefined): Character | null {
  if (!nameOrId) return null;
  const q = nameOrId.trim().toLowerCase();
  return (
    CHARACTER_PRESETS.find((c) => c.id === q || c.name.toLowerCase() === q) ?? null
  );
}
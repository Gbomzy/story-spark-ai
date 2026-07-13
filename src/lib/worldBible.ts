// World Bible — canonical setting/prop/art-style memory for a project.
// Persisted inside Story Bible as `world` alongside characters.

export type WorldBible = {
  locations: string[];
  buildings: string[];
  trees: string[];
  roads: string[];
  rivers: string[];
  mountains: string[];
  schools: string[];
  houses: string[];
  vehicles: string[];
  props: string[];
  lighting?: string;
  weather?: string;
  artStyle?: string;
  notes?: string;
};

export function emptyWorldBible(): WorldBible {
  return {
    locations: [], buildings: [], trees: [], roads: [], rivers: [], mountains: [],
    schools: [], houses: [], vehicles: [], props: [],
  };
}

export function parseWorldBible(input: unknown): WorldBible {
  const base = emptyWorldBible();
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;
  const arr = (k: keyof WorldBible) => (Array.isArray(raw[k]) ? (raw[k] as unknown[]).map(String) : []);
  return {
    ...base,
    locations: arr("locations"),
    buildings: arr("buildings"),
    trees: arr("trees"),
    roads: arr("roads"),
    rivers: arr("rivers"),
    mountains: arr("mountains"),
    schools: arr("schools"),
    houses: arr("houses"),
    vehicles: arr("vehicles"),
    props: arr("props"),
    lighting: raw.lighting ? String(raw.lighting) : undefined,
    weather: raw.weather ? String(raw.weather) : undefined,
    artStyle: raw.artStyle ? String(raw.artStyle) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
  };
}

/** Auto-extract nouns of interest from a story text into World Bible buckets. */
export function extractWorldFromStory(story: string, existing?: WorldBible): WorldBible {
  const w = existing ? { ...existing } : emptyWorldBible();
  const t = (story ?? "").toLowerCase();
  const pushUnique = (arr: string[], v: string) => { if (v && !arr.includes(v)) arr.push(v); };
  const grab = (re: RegExp, bucket: string[]) => {
    const m = t.match(re); if (m) for (const w of m) pushUnique(bucket, w.trim());
  };
  grab(/\b(forest|village|castle|city|kingdom|town|park|meadow|beach|desert|jungle)\b/g, w.locations);
  grab(/\b(tower|cottage|palace|library|tavern|hut|barn|temple|shop)\b/g, w.buildings);
  grab(/\b(oak|pine|willow|birch|maple)\b/g, w.trees);
  grab(/\b(river|stream|creek|brook|pond|lake)\b/g, w.rivers);
  grab(/\b(mountain|hill|cliff|peak|valley)\b/g, w.mountains);
  grab(/\b(school|classroom|playground)\b/g, w.schools);
  grab(/\b(house|home|cabin|cottage)\b/g, w.houses);
  grab(/\b(car|wagon|cart|boat|ship|train|bicycle|carriage)\b/g, w.vehicles);
  return w;
}

export function worldToPromptContext(w: WorldBible | null | undefined): string {
  if (!w) return "";
  const lines: string[] = ["WORLD BIBLE (reuse consistently, do not contradict):"];
  const add = (label: string, arr: string[]) => { if (arr?.length) lines.push(`${label}: ${arr.join(", ")}`); };
  add("Locations", w.locations);
  add("Buildings", w.buildings);
  add("Nature", [...w.trees, ...w.rivers, ...w.mountains]);
  add("Props", w.props);
  if (w.artStyle) lines.push(`Art style: ${w.artStyle}`);
  if (w.lighting) lines.push(`Lighting: ${w.lighting}`);
  if (w.weather) lines.push(`Default weather: ${w.weather}`);
  if (w.notes) lines.push(`Notes: ${w.notes}`);
  return lines.join("\n");
}
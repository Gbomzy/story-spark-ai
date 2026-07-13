// Content-hash cache index — additive layer over project_assets.
//
// The real asset rows live in project_assets/asset_versions; this helper
// just derives stable hashes for prompts + inputs so callers can skip
// regenerating identical assets. Hash inputs are intentionally small and
// deterministic; no crypto is used because collisions here are harmless.

export type CacheKey = {
  kind: string;
  projectId: string;
  hash: string;
};

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function hashInputs(...inputs: Array<string | number | undefined | null>): string {
  return fnv1a(inputs.map((i) => (i == null ? "" : String(i))).join("\u241f"));
}

export function makeCacheKey(kind: string, projectId: string, ...inputs: unknown[]): CacheKey {
  const norm = inputs.map((i) =>
    typeof i === "string" || typeof i === "number" ? i : JSON.stringify(i ?? null),
  );
  return { kind, projectId, hash: hashInputs(kind, projectId, ...norm) };
}

const mem = new Map<string, { at: number; value: string }>();

export function cacheGet(key: CacheKey): string | null {
  const k = `${key.kind}:${key.projectId}:${key.hash}`;
  return mem.get(k)?.value ?? null;
}

export function cachePut(key: CacheKey, value: string): void {
  const k = `${key.kind}:${key.projectId}:${key.hash}`;
  mem.set(k, { at: Date.now(), value });
}

export function cacheStats(): { entries: number } {
  return { entries: mem.size };
}

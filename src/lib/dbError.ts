// Convert Supabase/PostgREST errors (and any thrown value) into a
// readable message. Always logs the raw error to the console so devs
// can see the full payload.

export type LikePgError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export function formatDbError(err: unknown, fallback = "Save failed"): string {
  try {
    // eslint-disable-next-line no-console
    console.error("[db-error]", err);
  } catch {
    /* ignore */
  }
  if (!err) return fallback;
  if (err instanceof Error) {
    const anyErr = err as Error & LikePgError;
    const parts: string[] = [anyErr.message || fallback];
    if (anyErr.details) parts.push(String(anyErr.details));
    if (anyErr.hint) parts.push(`hint: ${anyErr.hint}`);
    if (anyErr.code) parts.push(`code: ${anyErr.code}`);
    return parts.join(" — ");
  }
  if (typeof err === "object") {
    const e = err as LikePgError & Record<string, unknown>;
    const parts: string[] = [];
    if (e.message) parts.push(String(e.message));
    if (e.details) parts.push(String(e.details));
    if (e.hint) parts.push(`hint: ${e.hint}`);
    if (e.code) parts.push(`code: ${e.code}`);
    return parts.length ? parts.join(" — ") : fallback;
  }
  return String(err) || fallback;
}

// Wrap an async supabase call so it always throws an Error carrying the
// full formatted message. Use inside mutation handlers.
export async function runDb<T>(op: () => Promise<T>, fallback = "Save failed"): Promise<T> {
  try {
    return await op();
  } catch (err) {
    throw new Error(formatDbError(err, fallback));
  }
}
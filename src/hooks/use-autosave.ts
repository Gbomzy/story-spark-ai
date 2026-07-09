import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  opts?: { delayMs?: number; enabled?: boolean },
): { status: SaveStatus; lastSavedAt: number | null; flush: () => Promise<void> } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (opts?.enabled === false) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setStatus("offline"); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await save(latest.current);
        setStatus("saved");
        setLastSavedAt(Date.now());
      } catch {
        setStatus("error");
      }
    }, opts?.delayMs ?? 1200);
    return () => { if (timer.current) clearTimeout(timer.current); };
     
  }, [value]);

  return {
    status,
    lastSavedAt,
    flush: async () => {
      if (timer.current) clearTimeout(timer.current);
      setStatus("saving");
      try { await save(latest.current); setStatus("saved"); setLastSavedAt(Date.now()); }
      catch { setStatus("error"); throw new Error("save-failed"); }
    },
  };
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}
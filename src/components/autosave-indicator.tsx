import { Cloud, CloudOff, Check, Loader2, AlertCircle } from "lucide-react";
import type { SaveStatus } from "@/hooks/use-autosave";

export function AutosaveIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt?: number | null }) {
  const map = {
    idle:    { icon: <Cloud className="h-3.5 w-3.5" />,   label: "Ready",    tone: "text-muted-foreground" },
    saving:  { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: "Saving…", tone: "text-primary" },
    saved:   { icon: <Check className="h-3.5 w-3.5" />,   label: lastSavedAt ? `Saved · ${new Date(lastSavedAt).toLocaleTimeString()}` : "Saved", tone: "text-emerald-500" },
    error:   { icon: <AlertCircle className="h-3.5 w-3.5" />, label: "Unsaved changes", tone: "text-destructive" },
    offline: { icon: <CloudOff className="h-3.5 w-3.5" />, label: "Offline", tone: "text-amber-500" },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.tone}`}>
      {s.icon}{s.label}
    </span>
  );
}
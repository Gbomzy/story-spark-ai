import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Mic, Sparkles, Loader2, RefreshCw, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { audioService } from "@/lib/audioService";
import { subtitleService } from "@/lib/subtitleService";
import { sanitizeVoiceScript } from "@/lib/voiceScript";

const VOICES = [
  "longxiaochun",
  "longxiaocheng",
  "longwan",
  "longcheng",
  "longhua",
  "longxiaobai",
  "longxiaoxia",
] as const;

export function AudioPanel({
  script,
  value,
  projectId,
}: {
  script: string;
  value?: string | null;
  projectId?: string;
}) {
  const asset = audioService.parseAsset(value);
  const configured = audioService.isConfigured();
  // The narrator should read the story, not the screenplay annotations.
  const spokenScript = sanitizeVoiceScript(script);
  const hasScript = Boolean(spokenScript);
  const [voice, setVoice] = useState<string>("longxiaochun");
  const [state, setState] = useState<{
    status: "idle" | "generating" | "ready" | "error";
    url?: string;
    provider?: string;
    error?: string;
  }>(() => (asset.url ? { status: "ready", url: asset.url } : { status: "idle" }));

  async function generate() {
    if (!hasScript) return;
    setState({ status: "generating" });
    try {
      const r = await audioService.generateFromScript(spokenScript, { voice, projectId });
      setState({ status: "ready", url: r.url ?? undefined, provider: r.voice });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Voice generation failed";
      setState({ status: "error", error: msg });
      toast.error(msg);
    }
  }

  function download(kind: "mp3" | "srt" | "vtt") {
    if (kind === "mp3") {
      if (!state.url) return;
      const a = document.createElement("a");
      a.href = state.url;
      a.download = "narration.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    subtitleService.generateFromScript(spokenScript, kind).then((sub) => {
      const a = document.createElement("a");
      a.href = sub.url ?? "";
      a.download = `narration.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  const displayUrl = state.url ?? asset.url;
  const statusLabel =
    state.status === "ready" || displayUrl
      ? "Ready"
      : state.status === "generating"
        ? "Synthesizing"
        : state.status === "error"
          ? "Error"
          : hasScript
            ? "Ready to render"
            : "Waiting for script";
  const badgeClass =
    state.status === "ready" || displayUrl
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : state.status === "error"
        ? "bg-red-500/15 text-red-600 dark:text-red-400"
        : "bg-primary/15 text-primary";

  return (
    <Card className="glass rounded-2xl p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-white shadow-glow">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Voice over</p>
            <p className="text-[11px] text-muted-foreground">
              CosyVoice · voice “{voice}”
            </p>
            {!configured && (
              <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                Set DASHSCOPE_API_KEY or QWEN_API_KEY to enable voice generation.
              </p>
            )}
          </div>
        </div>
        <Badge className={`rounded-full text-[10px] uppercase tracking-wider ${badgeClass}`}>
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-3">
        {displayUrl ? (
          <audio controls src={displayUrl} className="w-full" />
        ) : state.status === "error" ? (
          <div className="grid h-14 place-items-center gap-1 rounded-xl border border-dashed border-red-500/40 px-4 text-center text-[11px] text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="line-clamp-2">{state.error}</span>
          </div>
        ) : (
          <div className="grid h-14 place-items-center rounded-xl border border-dashed border-border text-[11px] text-muted-foreground">
            {state.status === "generating"
              ? "Synthesizing narration…"
              : "Audio player will appear here once a voice file is generated."}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={voice} onValueChange={setVoice}>
          <SelectTrigger className="h-9 w-32 rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOICES.map((v) => (
              <SelectItem key={v} value={v} className="text-xs capitalize">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          disabled={!configured || !hasScript || state.status === "generating"}
          onClick={generate}
          className="flex-1 rounded-lg gradient-primary text-white shadow-glow hover:opacity-95 disabled:opacity-60"
        >
          {state.status === "generating" ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Synthesizing…</>
          ) : displayUrl ? (
            <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate</>
          ) : (
            <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate voice</>
          )}
        </Button>
      </div>

      {(displayUrl || hasScript) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {displayUrl && (
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => download("mp3")}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> MP3
            </Button>
          )}
          {hasScript && (
            <>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => download("srt")}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> SRT
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => download("vtt")}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> VTT
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

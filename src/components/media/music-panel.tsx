import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, Lock, Sparkles } from "lucide-react";
import { musicService } from "@/lib/musicService";

export function MusicPanel({ lyrics, value }: { lyrics: string; value?: string | null }) {
  const asset = musicService.parseAsset(value);
  const configured = musicService.isConfigured();
  const hasLyrics = Boolean(lyrics.trim());

  return (
    <Card className="glass rounded-2xl p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-warm text-white shadow-glow">
            <Music className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Original song</p>
            <p className="text-[11px] text-muted-foreground">
              {asset.url ? "MP3 ready" : hasLyrics ? "Lyrics ready — music synthesis coming soon" : "Waiting for lyrics"}
            </p>
          </div>
        </div>
        <Badge className="rounded-full bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
          Unavailable
        </Badge>
      </div>

      <div className="mt-3">
        {asset.url ? (
          <audio controls src={asset.url} className="w-full" />
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
            Music generation is currently unavailable under the configured Qwen Cloud capabilities. Lyrics remain available for export.
          </div>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!configured || !hasLyrics}
        className="mt-3 w-full rounded-lg gradient-warm text-white shadow-glow hover:opacity-95 disabled:opacity-60"
      >
        {configured ? (
          <><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate music</>
        ) : (
          <><Lock className="mr-1.5 h-3.5 w-3.5" /> Generate music</>
        )}
      </Button>
    </Card>
  );
}

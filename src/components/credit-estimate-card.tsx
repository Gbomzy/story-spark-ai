import { Card } from "@/components/ui/card";
import { Zap, Clock } from "lucide-react";
import { estimate, formatSeconds, type EstimatorKind } from "@/lib/creditEstimator";

export function CreditEstimateCard({ kind, words, scenes, seconds, resolution, creativity }: {
  kind: EstimatorKind; words?: number; scenes?: number; seconds?: number;
  resolution?: "480p" | "720p" | "1080p" | "2k" | "4k"; creativity?: number;
}) {
  const e = estimate({ kind, words, scenes, seconds, resolution, creativity });
  return (
    <Card className="glass flex items-center justify-between gap-3 rounded-2xl p-3 shadow-soft">
      <span className="text-xs font-medium">{e.label}</span>
      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-primary"><Zap className="h-3.5 w-3.5" /> ~{e.credits} credits</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> ~{formatSeconds(e.seconds)}</span>
      </div>
    </Card>
  );
}
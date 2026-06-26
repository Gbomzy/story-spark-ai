import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type AgentStatus = "thinking" | "idle" | "ready" | "queued";

export type Agent = {
  name: string;
  icon: LucideIcon;
  status: AgentStatus;
  progress: number;
  lastTask: string;
  tone: "primary" | "warm" | "cool";
};

const statusColor: Record<AgentStatus, string> = {
  thinking: "bg-primary/15 text-primary",
  idle: "bg-muted text-muted-foreground",
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  queued: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

export function AgentCard({ agent }: { agent: Agent }) {
  const Icon = agent.icon;
  const toneClass =
    agent.tone === "primary" ? "gradient-primary" : agent.tone === "warm" ? "gradient-warm" : "gradient-cool";

  return (
    <Card className="glass group relative overflow-hidden rounded-3xl p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition group-hover:bg-primary/20" />
      <div className="relative flex items-start gap-4">
        <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-glow", toneClass)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-semibold">{agent.name}</h3>
            <Badge variant="secondary" className={cn("rounded-full text-[10px] uppercase tracking-wider", statusColor[agent.status])}>
              {agent.status === "thinking" && (
                <span className="mr-1 inline-flex gap-0.5">
                  <span className="h-1 w-1 animate-thinking rounded-full bg-current" />
                  <span className="h-1 w-1 animate-thinking rounded-full bg-current [animation-delay:120ms]" />
                  <span className="h-1 w-1 animate-thinking rounded-full bg-current [animation-delay:240ms]" />
                </span>
              )}
              {agent.status}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{agent.lastTask}</p>
        </div>
      </div>
      <div className="relative mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Progress</span>
          <span className="tabular-nums">{agent.progress}%</span>
        </div>
        <div className="relative">
          <Progress value={agent.progress} className="h-1.5 rounded-full" />
          {agent.status === "thinking" && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <div className="shimmer-bar h-full w-full" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
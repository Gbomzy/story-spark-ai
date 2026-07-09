import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS, providerLabel, type ProviderStatus } from "@/lib/providers";
import { CheckCircle2, XCircle, Zap, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/ai-providers")({
  head: () => ({ meta: [{ title: "AI Providers — StorySpark AI" }] }),
  component: AIProvidersPage,
});

function AIProvidersPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="AI Providers"
        description="All model and media providers used by StorySpark. Providers are pluggable — swap them without changing your projects."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((p) => (
          <Card key={p.id} className="glass rounded-2xl p-5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{p.vendor}</p>
              </div>
              <StatusPill status={p.status} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{p.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.capabilities.map((c) => (
                <Badge key={c} variant="outline" className="rounded-full text-[10px] uppercase tracking-wider">
                  {c}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ProviderStatus }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> {providerLabel(status)}
      </span>
    );
  }
  if (status === "api_ready") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
        <Zap className="h-3 w-3" /> {providerLabel(status)}
      </span>
    );
  }
  if (status === "coming_soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
        <Clock className="h-3 w-3" /> {providerLabel(status)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      <XCircle className="h-3 w-3" /> {providerLabel(status)}
    </span>
  );
}
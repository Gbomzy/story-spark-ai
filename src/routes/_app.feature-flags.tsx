import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { listFlags, setFlag, FEATURE_FLAG_CATALOG } from "@/lib/featureFlags";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/feature-flags")({
  head: () => ({ meta: [{ title: "Feature flags — StorySpark AI" }] }),
  component: FlagsPage,
});

function FlagsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["flags"], queryFn: listFlags });
  const state = new Map((q.data ?? []).map((f) => [f.flag_key, f.enabled]));
  const mut = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => setFlag(v.key, v.enabled),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["flags"] }); toast.success("Flag updated"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const groups = Array.from(new Set(FEATURE_FLAG_CATALOG.map((f) => f.category)));

  return (
    <div className="space-y-6">
      <PageHeader title="Feature flags" description="Enable beta modules, experimental providers, and future features for your workspace." />
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <Card key={g} className="glass rounded-3xl p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{g}</h3>
            <div className="space-y-3">
              {FEATURE_FLAG_CATALOG.filter((f) => f.category === g).map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{f.label}</span>
                  <Switch checked={state.get(f.key) ?? false} onCheckedChange={(v) => mut.mutate({ key: f.key, enabled: v })} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
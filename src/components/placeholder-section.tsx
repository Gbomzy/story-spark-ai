import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PlaceholderSection({
  icon: Icon,
  title,
  description,
  cta = "Coming soon",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: string;
}) {
  return (
    <Card className="glass flex flex-col items-center justify-center gap-4 rounded-3xl p-12 text-center shadow-soft">
      <div className="grid h-16 w-16 place-items-center rounded-2xl gradient-primary shadow-glow">
        <Icon className="h-7 w-7 text-white" />
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="secondary" className="rounded-xl">{cta}</Button>
      <p className="text-xs text-muted-foreground">
        Hook this section up to the Qwen API in <code className="rounded bg-muted px-1.5 py-0.5">/api</code> when ready.
      </p>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/templates")({
  head: () => ({ meta: [{ title: "Templates — StorySpark AI" }] }),
  component: TemplatesPage,
});

const templates = [
  { name: "Bedtime Adventure", topic: "Calm storytelling", duration: "5 min", color: "gradient-cool" },
  { name: "Counting Caper", topic: "Math basics", duration: "3 min", color: "gradient-warm" },
  { name: "Tiny Scientist", topic: "STEM curiosity", duration: "6 min", color: "gradient-primary" },
  { name: "Kindness Quest", topic: "Social emotional", duration: "4 min", color: "gradient-warm" },
  { name: "Space Explorers", topic: "Astronomy", duration: "7 min", color: "gradient-cool" },
  { name: "Eco Heroes", topic: "Sustainability", duration: "5 min", color: "gradient-primary" },
];

function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Templates" description="Start from a proven format and remix to taste." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.name} className="glass overflow-hidden rounded-3xl p-0 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
            <div className={`relative grid h-28 place-items-center ${t.color}`}>
              <LayoutTemplate className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-3 p-5">
              <div>
                <p className="font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.topic}</p>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="rounded-full">{t.duration}</Badge>
                <Button size="sm" className="rounded-lg gradient-primary text-white shadow-glow hover:opacity-95">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Use
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

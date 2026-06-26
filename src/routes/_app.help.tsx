import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { LifeBuoy, BookOpen, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/help")({
  head: () => ({ meta: [{ title: "Help — StorySpark AI" }] }),
  component: HelpPage,
});

const faqs = [
  { q: "How do I create a new project?", a: "Click 'Create New Project' from the dashboard, fill in the brief, and hit Generate." },
  { q: "Which AI models power StorySpark?", a: "Story, voice and image generation are powered by the Qwen multimodal API." },
  { q: "Can I use the videos commercially?", a: "Yes — Pro and Studio plans include a commercial license." },
  { q: "How do I invite my classroom?", a: "Teacher seats are coming soon. Reach out via support to join the beta." },
];

function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Help & support" description="Guides, FAQs and a direct line to the team." />

      <div className="grid gap-4 md:grid-cols-3">
        <HelpCard icon={BookOpen} title="Documentation" body="Tutorials and recipes for every feature." />
        <HelpCard icon={MessageCircle} title="Community" body="Tips and templates from fellow creators." />
        <HelpCard icon={LifeBuoy} title="Contact support" body="Real humans, fast responses." />
      </div>

      <Card className="glass rounded-3xl p-6 shadow-soft">
        <h3 className="mb-2 font-semibold">Frequently asked</h3>
        <Accordion type="single" collapsible>
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </div>
  );
}

function HelpCard({ icon: Icon, title, body }: { icon: typeof LifeBuoy; title: string; body: string }) {
  return (
    <Card className="glass rounded-3xl p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-glow">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl gradient-primary text-white shadow-glow">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Button variant="ghost" size="sm" className="mt-3 rounded-lg px-0 text-primary">Open →</Button>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { AgentCard, type Agent } from "@/components/agent-card";
import { OutputWorkspace } from "@/components/output-workspace";
import { BookOpen, Users, Film, Mic, Music, ImageIcon, Search } from "lucide-react";

export const Route = createFileRoute("/_app/ai-agents")({
  head: () => ({ meta: [{ title: "AI Agents — StorySpark AI" }] }),
  component: AgentsPage,
});

const agents: Agent[] = [
  { name: "Story Agent", icon: BookOpen, status: "thinking", progress: 64, lastTask: "Drafting chapter 3 of 'Lila & the Friendly Star'", tone: "primary" },
  { name: "Character Agent", icon: Users, status: "ready", progress: 100, lastTask: "Generated 4 supporting characters", tone: "warm" },
  { name: "Storyboard Agent", icon: Film, status: "queued", progress: 12, lastTask: "Waiting on final script", tone: "cool" },
  { name: "Voice Agent", icon: Mic, status: "thinking", progress: 38, lastTask: "Synthesising narrator track (EN-US)", tone: "primary" },
  { name: "Song Agent", icon: Music, status: "idle", progress: 0, lastTask: "Last composed: 'Tiny Astronauts theme'", tone: "warm" },
  { name: "Image Prompt Agent", icon: ImageIcon, status: "thinking", progress: 81, lastTask: "Crafting prompts for 6 scenes", tone: "cool" },
  { name: "SEO Agent", icon: Search, status: "ready", progress: 100, lastTask: "Title + tags ready for review", tone: "primary" },
];

function AgentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Agents"
        description="A team of specialised agents working in parallel on your project. Connect Qwen to bring them online."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((a) => (
          <AgentCard key={a.name} agent={a} />
        ))}
      </section>

      <OutputWorkspace />
    </div>
  );
}
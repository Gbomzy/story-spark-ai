import { createFileRoute } from "@tanstack/react-router";
import { ProjectWizard } from "@/components/project-wizard/project-wizard";

export const Route = createFileRoute("/_app/projects/new")({
  head: () => ({ meta: [{ title: "New project — StorySpark AI" }] }),
  component: () => <ProjectWizard />,
});
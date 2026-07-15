import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_project",
  title: "Create project",
  description: "Create a new StorySpark AI project for the signed-in user.",
  inputSchema: {
    name: z.string().trim().min(1).max(120).describe("Project name shown in the dashboard"),
    topic: z.string().trim().max(500).optional().describe("Optional story topic / prompt"),
    language: z.string().trim().max(20).optional(),
    style: z.string().trim().max(50).optional(),
    target_age: z.string().trim().max(20).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ name, topic, language, style, target_age }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("projects")
      .insert({
        user_id: ctx.getUserId(),
        name,
        topic: topic ?? null,
        language: language ?? null,
        style: style ?? null,
        target_age: target_age ?? null,
      })
      .select("id,name,topic,created_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { project: data },
    };
  },
});
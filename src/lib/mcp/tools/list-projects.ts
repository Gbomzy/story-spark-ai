import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description: "List the signed-in user's StorySpark AI movie projects, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max projects to return (default 20)"),
    includeArchived: z.boolean().optional().describe("Include archived projects (default false)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, includeArchived }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("projects")
      .select("id,name,topic,status:render_status,is_archived,is_favorite,updated_at,created_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (!includeArchived) q = q.eq("is_archived", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { projects: data ?? [] },
    };
  },
});
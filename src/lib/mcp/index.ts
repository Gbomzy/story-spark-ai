import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listProjectsTool from "./tools/list-projects";
import getProjectTool from "./tools/get-project";
import createProjectTool from "./tools/create-project";
import getCreditBalanceTool from "./tools/get-credit-balance";

// Direct Supabase issuer — the .lovable.cloud runtime URL is a proxy and does
// not match the issuer advertised in discovery (RFC 8414). Read the project
// ref from Vite's build-time env; the fallback keeps the URL well-formed
// during the manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "storyspark-ai-mcp",
  title: "StorySpark AI",
  version: "0.1.0",
  instructions:
    "Tools for StorySpark AI. Use `whoami` to check the signed-in user, `list_projects` and `get_project` to browse movie projects, `create_project` to start a new one, and `get_credit_balance` to check the credit wallet.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listProjectsTool, getProjectTool, createProjectTool, getCreditBalanceTool],
});
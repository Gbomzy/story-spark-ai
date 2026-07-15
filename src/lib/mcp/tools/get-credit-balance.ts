import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_credit_balance",
  title: "Get credit balance",
  description: "Return the signed-in user's StorySpark AI credit wallet balance.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("credit_wallet")
      .select("balance,reserved,subscription_credits,topup_credits,bonus_credits,unlimited_credits,lifetime_used,lifetime_purchased")
      .eq("user_id", ctx.getUserId())
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const wallet = data ?? { balance: 0 };
    return {
      content: [{ type: "text", text: JSON.stringify(wallet) }],
      structuredContent: { wallet },
    };
  },
});
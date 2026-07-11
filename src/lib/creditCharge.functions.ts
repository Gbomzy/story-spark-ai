import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Universal credit-charge wrappers used by every AI generator.
 *   precheckOperation   → { ok, required, available } BEFORE work
 *   reserveForOperation → locks credits before the AI call
 *   commitForOperation  → deducts on success
 *   refundForOperation  → releases the reserve on failure
 */

const OP = z.enum(["story", "character", "storyboard", "image", "voice", "video", "ocr", "translation", "admin_debit"]);

async function costFor(op: string, units: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("credit_costs").select("credits").eq("operation", op).eq("is_active", true).maybeSingle();
  const per = data?.credits ?? 0;
  return Math.max(1, Math.ceil(per * Math.max(1, units)));
}

export const precheckOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operation: OP, units: z.number().min(1).default(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const required = await costFor(data.operation, data.units);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("credit_wallet").upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: w } = await supabaseAdmin.from("credit_wallet").select("balance, reserved").eq("user_id", context.userId).maybeSingle();
    const available = (w?.balance ?? 0) - (w?.reserved ?? 0);
    return { ok: available >= required, required, available };
  });

export const reserveForOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operation: OP, units: z.number().min(1).default(1), projectId: z.string().uuid().optional(), ref: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const required = await costFor(data.operation, data.units);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("credit_reserve", { _user: context.userId, _operation: data.operation, _credits: required, _project: data.projectId ?? null, _ref: data.ref ?? null });
    if (error) throw new Error(error.message);
    return { ...(r as Record<string, unknown>), required };
  });

export const commitForOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operation: OP, credits: z.number().min(1), projectId: z.string().uuid().optional(), provider: z.string().optional(), model: z.string().optional(), ref: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("credit_commit", { _user: context.userId, _operation: data.operation, _credits: data.credits, _project: data.projectId ?? null, _provider: data.provider ?? null, _model: data.model ?? null, _ref: data.ref ?? null });
    if (error) throw new Error(error.message);
    return r;
  });

export const refundForOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ operation: OP, credits: z.number().min(1), projectId: z.string().uuid().optional(), ref: z.string().optional(), reason: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin.rpc("credit_refund", { _user: context.userId, _operation: data.operation, _credits: data.credits, _project: data.projectId ?? null, _ref: data.ref ?? null, _reason: data.reason ?? "generation_failed" });
    if (error) throw new Error(error.message);
    return r;
  });
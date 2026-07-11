// Server-only helpers for wrapping AI-generator handler bodies with a credit
// reserve then commit-or-refund cycle. Import inside a .handler body, never at
// module scope of a *.functions.ts file.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Operation = "story" | "character" | "storyboard" | "image" | "voice" | "video" | "ocr" | "translation";

export interface ChargeHandle {
  credits: number;
  operation: Operation;
  ref: string;
  commit(providerModel?: string): Promise<void>;
  refund(reason?: string): Promise<void>;
}

async function getAdmin(): Promise<SupabaseClient<Database>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function costFor(op: Operation, units: number, admin: SupabaseClient<Database>) {
  const { data } = await admin.from("credit_costs").select("credits").eq("operation", op).eq("is_active", true).maybeSingle();
  const per = data?.credits ?? 0;
  return Math.max(1, Math.ceil(per * Math.max(1, units)));
}

export async function beginCharge(params: {
  userId: string;
  operation: Operation;
  units?: number;
  projectId?: string | null;
  ref?: string;
}): Promise<ChargeHandle> {
  const admin = await getAdmin();
  const units = Math.max(1, params.units ?? 1);
  const credits = await costFor(params.operation, units, admin);
  const ref = params.ref ?? `${params.operation}_${Date.now().toString(36)}`;
  await admin.from("credit_wallet").upsert({ user_id: params.userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data, error } = await admin.rpc("credit_reserve", {
    _user: params.userId,
    _operation: params.operation,
    _credits: credits,
    _project: params.projectId ?? undefined,
    _ref: ref,
  });
  if (error) throw new Error(error.message);
  const res = data as { ok: boolean; error?: string };
  if (!res.ok) throw new Error(res.error === "insufficient_credits" ? `Insufficient credits (need ${credits})` : (res.error ?? "reserve_failed"));
  let settled = false;
  return {
    credits,
    operation: params.operation,
    ref,
    async commit(providerModel?: string) {
      if (settled) return;
      settled = true;
      await admin.rpc("credit_commit", {
        _user: params.userId,
        _operation: params.operation,
        _credits: credits,
        _project: params.projectId ?? undefined,
        _provider: providerModel ? providerModel.split("/")[0] : undefined,
        _model: providerModel,
        _ref: ref,
      });
    },
    async refund(reason?: string) {
      if (settled) return;
      settled = true;
      await admin.rpc("credit_refund", {
        _user: params.userId,
        _operation: params.operation,
        _credits: credits,
        _project: params.projectId ?? undefined,
        _ref: ref,
        _reason: reason ?? "generation_failed",
      });
    },
  };
}
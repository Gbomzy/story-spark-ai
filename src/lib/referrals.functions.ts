import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REFERRER_BONUS = 200;
const REFERRED_BONUS = 100;

export const getMyReferralCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("profiles").select("referral_code").eq("id", context.userId).maybeSingle();
    return { code: data?.referral_code ?? null };
  });

export const listMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("referrals").select("*").eq("referrer_id", context.userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const redeemReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(4).max(32) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.toUpperCase();
    const { data: existing } = await supabaseAdmin.from("referrals").select("id").eq("referred_id", context.userId).maybeSingle();
    if (existing) throw new Error("You've already redeemed a referral code");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("referral_code", code).maybeSingle();
    if (!profile) throw new Error("Invalid code");
    if (profile.id === context.userId) throw new Error("You cannot refer yourself");
    const { error: insErr } = await supabaseAdmin.from("referrals").insert({
      referrer_id: profile.id,
      referred_id: context.userId,
      code,
      referrer_credits_awarded: REFERRER_BONUS,
      referred_credits_awarded: REFERRED_BONUS,
      status: "credited",
      credited_at: new Date().toISOString(),
    });
    if (insErr) throw new Error(insErr.message);
    await supabaseAdmin.rpc("credit_grant", { _user: profile.id, _credits: REFERRER_BONUS, _reason: `Referral bonus (${code})`, _kind: "bonus" });
    await supabaseAdmin.rpc("credit_grant", { _user: context.userId, _credits: REFERRED_BONUS, _reason: `Welcome referral bonus (${code})`, _kind: "bonus" });
    return { ok: true, referrerBonus: REFERRER_BONUS, yourBonus: REFERRED_BONUS };
  });
import { supabase } from "@/integrations/supabase/client";

const t = (n: string) => (supabase as unknown as { from: (n: string) => ReturnType<typeof supabase.from> }).from(n);

export interface FeatureFlag {
  id: string;
  user_id: string;
  flag_key: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const FEATURE_FLAG_CATALOG = [
  { key: "beta_wan_video",       label: "Wan Video (beta)",           category: "Beta" },
  { key: "beta_happy_horse",     label: "Happy Horse (beta)",         category: "Beta" },
  { key: "beta_openai_provider", label: "OpenAI provider (beta)",     category: "Beta" },
  { key: "exp_rich_editor",      label: "Rich text editor",           category: "Experimental" },
  { key: "exp_realtime_collab",  label: "Realtime collaboration",     category: "Experimental" },
  { key: "exp_ai_agents",        label: "AI Agents workspace",        category: "Experimental" },
  { key: "future_marketplace",   label: "Template marketplace",       category: "Future" },
  { key: "future_mobile_app",    label: "Mobile app sync",            category: "Future" },
  { key: "future_voice_clone",   label: "Voice cloning",              category: "Future" },
] as const;

export type FlagKey = (typeof FEATURE_FLAG_CATALOG)[number]["key"];

export async function listFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await t("feature_flags").select("*");
  if (error) throw error;
  return (data ?? []) as unknown as FeatureFlag[];
}

export async function setFlag(flag_key: string, enabled: boolean) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await t("feature_flags").upsert(
    { user_id: u.user.id, flag_key, enabled },
    { onConflict: "user_id,flag_key" } as never,
  );
  if (error) throw error;
}
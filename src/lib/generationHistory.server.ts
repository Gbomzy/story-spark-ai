// Server-only helper that inserts into public.generation_history using the
// service role. RLS blocks INSERT from authenticated user sessions to protect
// credits_used and other financial-adjacent fields from client fabrication;
// this helper is the only trusted write path.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type HistoryEntry = {
  user_id: string;
  project_id?: string | null;
  asset_type: string;
  provider: string;
  status: "completed" | "failed" | string;
  duration_ms?: number | null;
  credits_used?: number | null;
  error_message?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function recordGenerationHistory(entry: HistoryEntry): Promise<void> {
  try {
    await supabaseAdmin.from("generation_history").insert(entry as never);
  } catch {
    // best-effort: history writes never break the primary flow
  }
}
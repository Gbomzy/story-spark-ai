import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ORCH_STAGES,
  computeProgress,
  emptyOrchestratorState,
  parseOrchestratorState,
  type OrchStage,
  type OrchestratorState,
} from "@/lib/orchestrator";

const StageInput = z.object({
  projectId: z.string().uuid(),
  stage: z.enum(ORCH_STAGES),
  creditsUsed: z.number().nonnegative().optional(),
  error: z.string().max(2000).optional(),
  currentScene: z.number().int().optional(),
  currentClip: z.number().int().optional(),
});

const ControlInput = z.object({
  projectId: z.string().uuid(),
  action: z.enum(["start", "pause", "resume", "cancel", "reset"]),
});

async function loadState(
  supabase: ReturnType<typeof getSb>,
  projectId: string,
  userId: string,
): Promise<OrchestratorState> {
  const { data, error } = await supabase
    .from("projects")
    .select("orchestrator_state,user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Project not found");
  if (data.user_id !== userId) throw new Error("Forbidden");
  return parseOrchestratorState(data.orchestrator_state);
}

function getSb(ctx: { supabase: unknown }) {
  // Purely for the inferred type in loadState — we never call this.
  return ctx.supabase as never;
}

async function saveState(
  supabase: ReturnType<typeof getSb>,
  projectId: string,
  state: OrchestratorState,
): Promise<void> {
  const patch = { ...state, progress: computeProgress(state), updatedAt: new Date().toISOString() };
  const { error } = await supabase
    .from("projects")
    .update({ orchestrator_state: patch })
    .eq("id", projectId);
  if (error) throw error;
}

export const getOrchestratorState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const state = await loadState(context.supabase as never, data.projectId, context.userId);
    return { state };
  });

export const controlOrchestrator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ControlInput.parse(input))
  .handler(async ({ data, context }) => {
    const state = await loadState(context.supabase as never, data.projectId, context.userId);
    const now = new Date().toISOString();
    if (data.action === "start") {
      if (!state.startedAt) state.startedAt = now;
      state.status = "running";
    } else if (data.action === "pause") {
      state.status = "paused";
    } else if (data.action === "resume") {
      state.status = "running";
    } else if (data.action === "cancel") {
      state.status = "failed";
      state.completedAt = now;
    } else if (data.action === "reset") {
      const fresh = emptyOrchestratorState();
      await saveState(context.supabase as never, data.projectId, fresh);
      return { state: fresh };
    }
    await saveState(context.supabase as never, data.projectId, state);
    return { state };
  });

export const markStageRunning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StageInput.parse(input))
  .handler(async ({ data, context }) => {
    const state = await loadState(context.supabase as never, data.projectId, context.userId);
    state.currentStage = data.stage as OrchStage;
    state.status = "running";
    if (typeof data.currentScene === "number") state.currentScene = data.currentScene;
    if (typeof data.currentClip === "number") state.currentClip = data.currentClip;
    state.stages[data.stage] = {
      ...state.stages[data.stage],
      state: "running",
      startedAt: new Date().toISOString(),
    };
    await saveState(context.supabase as never, data.projectId, state);
    return { state };
  });

export const markStageCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StageInput.parse(input))
  .handler(async ({ data, context }) => {
    const state = await loadState(context.supabase as never, data.projectId, context.userId);
    state.stages[data.stage] = {
      ...state.stages[data.stage],
      state: "completed",
      completedAt: new Date().toISOString(),
      creditsUsed: (state.stages[data.stage].creditsUsed ?? 0) + (data.creditsUsed ?? 0),
      error: undefined,
    };
    state.creditsUsed += data.creditsUsed ?? 0;
    // If every stage is completed/skipped, mark run complete.
    const allDone = ORCH_STAGES.every((s) => state.stages[s].state === "completed" || state.stages[s].state === "skipped");
    if (allDone) {
      state.status = "completed";
      state.completedAt = new Date().toISOString();
    }
    await saveState(context.supabase as never, data.projectId, state);
    return { state };
  });

export const markStageFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StageInput.parse(input))
  .handler(async ({ data, context }) => {
    const state = await loadState(context.supabase as never, data.projectId, context.userId);
    const entry = state.stages[data.stage];
    state.stages[data.stage] = {
      ...entry,
      state: "failed",
      error: data.error ?? "Stage failed",
      retryCount: (entry.retryCount ?? 0) + 1,
    };
    state.status = "failed";
    await saveState(context.supabase as never, data.projectId, state);
    return { state };
  });

export const markStageSkipped = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StageInput.parse(input))
  .handler(async ({ data, context }) => {
    const state = await loadState(context.supabase as never, data.projectId, context.userId);
    state.stages[data.stage] = {
      ...state.stages[data.stage],
      state: "skipped",
      completedAt: new Date().toISOString(),
    };
    await saveState(context.supabase as never, data.projectId, state);
    return { state };
  });

// Read all projects currently mid-production (for the orchestrator dashboard).
export const listInProgressProductions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as never as ReturnType<typeof getSb>)
      .from("projects")
      .select("id,name,orchestrator_state,updated_at")
      .eq("user_id", context.userId)
      .not("orchestrator_state", "is", null)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ id: string; name: string | null; orchestrator_state: unknown; updated_at: string }>;
    return {
      productions: rows.map((r) => ({
        id: r.id,
        name: r.name ?? "Untitled",
        state: parseOrchestratorState(r.orchestrator_state),
        updatedAt: r.updated_at,
      })),
    };
  });
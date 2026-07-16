// Quality Validator — runs before we spend credits on a render pass.
// Pure module; safe to import from server functions and client code.
//
// The pipeline calls `validateRenderInputs()` right after it has built the
// clip queue and BEFORE the first Wan call. If anything is clearly broken
// (empty prompts, TTS-poisoned narration, timing that overflows the Wan
// hard cap, orphan scenes without prompts) we throw so the render aborts
// cleanly instead of burning image/video credits on garbage input.

export type ValidationIssue = {
  code:
    | "empty_prompt"
    | "prompt_too_short"
    | "narration_empty"
    | "narration_has_directions"
    | "duration_overflow"
    | "scene_count_zero"
    | "duplicate_prompt";
  message: string;
  sceneNumber?: number;
};

export type ValidationReport = {
  ok: boolean;
  issues: ValidationIssue[];
};

export type ClipLike = {
  sceneNumber: number;
  clipNumber: number;
  prompt: string;
  durationSeconds: number;
};

const DIRECTION_ARTIFACT = /\[(narrator|sfx|music|pause|scene|shot|camera|vo|cut|fade)\b/i;

export function validateRenderInputs(args: {
  clips: ClipLike[];
  narration: string;
  maxClipSeconds: number;
  minPromptChars?: number;
}): ValidationReport {
  const issues: ValidationIssue[] = [];
  const min = args.minPromptChars ?? 40;

  if (!args.clips || args.clips.length === 0) {
    issues.push({ code: "scene_count_zero", message: "No scenes were queued for rendering." });
  }

  const seen = new Map<string, number>();
  for (const c of args.clips ?? []) {
    const p = (c.prompt ?? "").trim();
    if (!p) {
      issues.push({ code: "empty_prompt", message: `Scene ${c.sceneNumber} has an empty prompt.`, sceneNumber: c.sceneNumber });
      continue;
    }
    if (p.length < min) {
      issues.push({ code: "prompt_too_short", message: `Scene ${c.sceneNumber} prompt is too short (${p.length} chars).`, sceneNumber: c.sceneNumber });
    }
    if (c.durationSeconds > args.maxClipSeconds + 0.01) {
      issues.push({ code: "duration_overflow", message: `Scene ${c.sceneNumber} clip ${c.clipNumber} exceeds the ${args.maxClipSeconds}s Wan cap.`, sceneNumber: c.sceneNumber });
    }
    const key = p.slice(0, 120).toLowerCase();
    const prev = seen.get(key);
    if (prev != null && prev !== c.sceneNumber) {
      issues.push({ code: "duplicate_prompt", message: `Scenes ${prev} and ${c.sceneNumber} share nearly identical prompts.`, sceneNumber: c.sceneNumber });
    } else {
      seen.set(key, c.sceneNumber);
    }
  }

  const narration = (args.narration ?? "").trim();
  if (narration) {
    if (DIRECTION_ARTIFACT.test(narration)) {
      issues.push({
        code: "narration_has_directions",
        message: "Narration still contains stage directions ([NARRATOR]/[SFX]/[PAUSE]...) after sanitization.",
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function formatIssues(report: ValidationReport): string {
  return report.issues.map((i) => `• ${i.message}`).join("\n");
}
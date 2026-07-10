// DashScope (Alibaba Cloud / Qwen) server helper. SERVER-ONLY.
// Loaded from server-function handlers; never import at module scope of a
// client-reachable file.

export const DEFAULT_DASHSCOPE_BASE = "https://dashscope-intl.aliyuncs.com";
export const MULTIMODAL_GENERATION_PATH = "/api/v1/services/aigc/multimodal-generation/generation";

export function getDashScopeKey(): string {
  const key = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
  if (!key) throw new Error("DASHSCOPE_API_KEY (or QWEN_API_KEY) is not configured.");
  return key;
}

export function getBase(envName: string, fallback = DEFAULT_DASHSCOPE_BASE): string {
  return (process.env[envName] || fallback).replace(/\/+$/, "");
}

type FetchInit = RequestInit & { retries?: number };

export async function dashFetch(url: string, init: FetchInit = {}): Promise<Response> {
  const retries = init.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function runDashScopeJson<T = Record<string, unknown>>(input: {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
}): Promise<T> {
  const key = getDashScopeKey();
  const res = await dashFetch(input.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...input.headers,
    },
    body: JSON.stringify(input.body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DashScope request failed (${res.status}): ${txt.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/**
 * Submit an async DashScope task and poll until it succeeds or fails.
 * Returns the final `output` object.
 */
export async function runAsyncTask(input: {
  submitUrl: string;
  body: unknown;
  base?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<Record<string, unknown>> {
  const key = getDashScopeKey();
  const base = (input.base || DEFAULT_DASHSCOPE_BASE).replace(/\/+$/, "");
  const submitRes = await dashFetch(input.submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(input.body),
  });
  if (!submitRes.ok) {
    const txt = await submitRes.text();
    throw new Error(`DashScope submit failed (${submitRes.status}): ${txt.slice(0, 400)}`);
  }
  const submitJson = (await submitRes.json()) as {
    output?: { task_id?: string; task_status?: string };
    request_id?: string;
  };
  const taskId = submitJson.output?.task_id;
  if (!taskId) throw new Error(`DashScope did not return a task_id (${JSON.stringify(submitJson).slice(0, 300)})`);

  const timeoutMs = input.timeoutMs ?? 5 * 60_000;
  const interval = input.pollIntervalMs ?? 2500;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, interval));
    const pollRes = await dashFetch(`${base}/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!pollRes.ok) {
      const txt = await pollRes.text();
      throw new Error(`DashScope poll failed (${pollRes.status}): ${txt.slice(0, 400)}`);
    }
    const pollJson = (await pollRes.json()) as {
      output?: Record<string, unknown> & { task_status?: string; message?: string };
    };
    const status = pollJson.output?.task_status;
    if (status === "SUCCEEDED") return pollJson.output as Record<string, unknown>;
    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      throw new Error(`DashScope task ${status}: ${pollJson.output?.message ?? "no message"}`);
    }
  }
  throw new Error("DashScope task timed out.");
}

/**
 * Detect DashScope errors that mean "the requested model is unavailable
 * for this account" (deprecated / not enabled / typo). Callers use this
 * to iterate a fallback list of equivalent models.
 */
export function isModelUnavailableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Model not exist/i.test(msg) ||
    /model_not_found/i.test(msg) ||
    /InvalidParameter/i.test(msg) ||
    /invalid[_ ]?model/i.test(msg) ||
    /not\s+authorized/i.test(msg) ||
    /AccessDenied/i.test(msg) ||
    /\b400\b/.test(msg)
  );
}

/**
 * Try a list of candidate model ids in order; the caller supplies a builder
 * that returns the DashScope request body for a given model. The first
 * model that DashScope accepts wins. Non-model errors bubble immediately.
 */
export async function runAsyncTaskWithFallback<T extends { model: string }>(input: {
  submitUrl: string;
  base?: string;
  models: string[];
  buildBody: (model: string) => T;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<{ output: Record<string, unknown>; model: string; attempts: string[] }> {
  const attempts: string[] = [];
  let lastErr: unknown = new Error("No models supplied");
  for (const model of input.models) {
    attempts.push(model);
    try {
      const output = await runAsyncTask({
        submitUrl: input.submitUrl,
        base: input.base,
        pollIntervalMs: input.pollIntervalMs,
        timeoutMs: input.timeoutMs,
        body: input.buildBody(model),
      });
      return { output, model, attempts };
    } catch (e) {
      lastErr = e;
      if (isModelUnavailableError(e)) continue;
      throw e;
    }
  }
  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `DashScope: none of the candidate models were accepted (${attempts.join(", ")}). Last error: ${detail}`,
  );
}

export function getEnabledFlags(): {
  image: boolean;
  video: boolean;
  voice: boolean;
  asr: boolean;
  ocr: boolean;
  translation: boolean;
} {
  const hasKey = Boolean(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY);
  return { image: hasKey, video: hasKey, voice: hasKey, asr: hasKey, ocr: hasKey, translation: hasKey };
}
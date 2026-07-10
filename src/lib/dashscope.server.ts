// DashScope (Alibaba Cloud / Qwen) server helper. SERVER-ONLY.
// Loaded from server-function handlers; never import at module scope of a
// client-reachable file.

export const DEFAULT_DASHSCOPE_BASE = "https://dashscope-intl.aliyuncs.com";

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
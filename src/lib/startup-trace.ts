// Temporary startup instrumentation. Client-only. Safe to remove.
// Records timestamped events and exposes window.__startupTimeline().

type Event = { t: number; name: string; detail?: unknown };

const isBrowser = typeof window !== "undefined";
const START = isBrowser ? performance.now() : 0;
const events: Event[] = [];
let installed = false;

export function trace(name: string, detail?: unknown) {
  if (!isBrowser) return;
  const t = performance.now() - START;
  events.push({ t, name, detail });
  // eslint-disable-next-line no-console
  console.log(`[startup +${t.toFixed(1)}ms] ${name}`, detail ?? "");
}

export function installStartupTrace() {
  if (!isBrowser || installed) return;
  installed = true;

  trace("script:module-eval");

  window.addEventListener("error", (e) => {
    trace("window.error", { message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno });
  });
  window.addEventListener("unhandledrejection", (e) => {
    trace("window.unhandledrejection", { reason: String((e as PromiseRejectionEvent).reason) });
  });

  if ("PerformanceObserver" in window) {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 2000 && (entry.entryType === "resource" || entry.entryType === "navigation")) {
            trace("slow-request>2s", { name: (entry as PerformanceResourceTiming).name, duration: Math.round(entry.duration) });
          }
        }
      });
      po.observe({ entryTypes: ["resource", "navigation"] });
    } catch {}
  }

  if (document.readyState === "complete") {
    trace("document.readyState=complete (already)");
  } else {
    window.addEventListener("DOMContentLoaded", () => trace("DOMContentLoaded"));
    window.addEventListener("load", () => trace("window.load"));
  }

  (window as unknown as { __startupTimeline: () => Event[] }).__startupTimeline = () => {
    // eslint-disable-next-line no-console
    console.table(
      events.map((e, i) => ({
        "#": i,
        "t (ms)": e.t.toFixed(1),
        "Δ (ms)": (i === 0 ? 0 : e.t - events[i - 1].t).toFixed(1),
        Event: e.name,
      })),
    );
    return events.slice();
  };
}

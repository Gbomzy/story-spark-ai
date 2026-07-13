// Tiny HTMLAudioElement wrapper for the Audio Studio previews. Keeps a
// single element per instance so play/pause/loop/replace are trivial.

export type PreviewState = "idle" | "playing" | "paused" | "error";

export class AudioPreview {
  private el: HTMLAudioElement | null = null;
  private listeners = new Set<(s: PreviewState) => void>();
  private state: PreviewState = "idle";
  private _loop = false;

  constructor(private url: string | undefined) {}

  get loop() { return this._loop; }
  setLoop(v: boolean) {
    this._loop = v;
    if (this.el) this.el.loop = v;
  }

  setUrl(url: string | undefined) {
    this.url = url;
    if (this.el) {
      const wasPlaying = !this.el.paused;
      this.el.pause();
      this.el.src = url ?? "";
      if (wasPlaying && url) this.play();
    }
  }

  subscribe(fn: (s: PreviewState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(s: PreviewState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }

  private ensure(): HTMLAudioElement | null {
    if (this.el) return this.el;
    if (!this.url) return null;
    const a = new Audio(this.url);
    a.crossOrigin = "anonymous";
    a.loop = this._loop;
    a.addEventListener("play", () => this.emit("playing"));
    a.addEventListener("pause", () => this.emit(a.ended ? "idle" : "paused"));
    a.addEventListener("ended", () => this.emit("idle"));
    a.addEventListener("error", () => this.emit("error"));
    this.el = a;
    return a;
  }

  async play() {
    const a = this.ensure();
    if (!a) { this.emit("error"); return; }
    try { await a.play(); } catch { this.emit("error"); }
  }

  pause() { this.el?.pause(); }
  toggle() { if (this.state === "playing") this.pause(); else void this.play(); }

  dispose() {
    if (this.el) { this.el.pause(); this.el.src = ""; }
    this.el = null;
    this.listeners.clear();
  }
}
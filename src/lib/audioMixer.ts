// Web Audio preview mixer for the Audio Studio.
//
// Supports three preview modes matching the production audio requirements:
//
//   • "narration" — voice-over only, no music/SFX.
//   • "music"     — background music (and optional SFX) only.
//   • "mix"       — final mix: narration + BGM with automatic ducking
//                   (music lowers while narration is speaking), plus a
//                   soft-limiter to prevent clipping.
//
// Volume levels mirror the production spec:
//   narration 100%, music 25% (0.25), sfx 35% (0.35).
//
// A single instance owns its AudioContext, media elements and gain graph,
// and exposes a tiny observable interface consumable from React state.

export type PreviewMode = "narration" | "music" | "mix";
export type PreviewMixerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "playing"; mode: PreviewMode; positionSec: number; durationSec: number }
  | { status: "paused"; mode: PreviewMode; positionSec: number; durationSec: number }
  | { status: "error"; error: string };

export type PreviewInputs = {
  narrationUrl?: string;
  musicUrl?: string;
  sfxUrls?: string[];
  /** Optional gains override in [0..1]. */
  narrationVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
  /** Ducking config — target music level while narration speaks. */
  duckedLevel?: number;
  duckThreshold?: number;
  attackMs?: number;
  releaseMs?: number;
};

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

export class AudioMixer {
  private ctx: AudioContext | null = null;
  private narrationEl: HTMLAudioElement | null = null;
  private musicEl: HTMLAudioElement | null = null;
  private sfxEls: HTMLAudioElement[] = [];
  private narrationGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserBuf: Uint8Array | null = null;
  private raf: number | null = null;
  private mode: PreviewMode = "mix";
  private listeners = new Set<(s: PreviewMixerState) => void>();
  private state: PreviewMixerState = { status: "idle" };
  private inputs: PreviewInputs = {};

  subscribe(fn: (s: PreviewMixerState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }
  private emit(s: PreviewMixerState) {
    this.state = s;
    this.listeners.forEach((l) => l(s));
  }

  setInputs(inputs: PreviewInputs) {
    this.inputs = { ...inputs };
  }

  async play(mode: PreviewMode): Promise<void> {
    this.mode = mode;
    try {
      await this.ensureGraph();
      const ctx = this.ctx!;
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});
      // Wire per-mode routing via gain values.
      const narrationVol = clamp(this.inputs.narrationVolume ?? 1);
      const musicVol = clamp(this.inputs.musicVolume ?? 0.25);
      const narrationOn = mode !== "music";
      const musicOn = mode !== "narration";
      if (this.narrationGain) this.narrationGain.gain.value = narrationOn ? narrationVol : 0;
      if (this.musicGain) this.musicGain.gain.value = musicOn ? musicVol : 0;
      // Start elements.
      if (this.narrationEl && narrationOn) {
        this.narrationEl.currentTime = 0;
        await this.narrationEl.play().catch(() => undefined);
      }
      if (this.musicEl && musicOn) {
        this.musicEl.loop = true;
        this.musicEl.currentTime = 0;
        await this.musicEl.play().catch(() => undefined);
      }
      if (musicOn) {
        for (const el of this.sfxEls) {
          el.currentTime = 0;
          el.play().catch(() => undefined);
        }
      }
      this.tick();
    } catch (e) {
      this.emit({ status: "error", error: e instanceof Error ? e.message : "Preview failed" });
    }
  }

  pause() {
    this.narrationEl?.pause();
    this.musicEl?.pause();
    this.sfxEls.forEach((el) => el.pause());
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    const primary = this.narrationEl ?? this.musicEl;
    if (primary)
      this.emit({
        status: "paused",
        mode: this.mode,
        positionSec: primary.currentTime,
        durationSec: Number.isFinite(primary.duration) ? primary.duration : 0,
      });
    else this.emit({ status: "idle" });
  }

  stop() {
    this.pause();
    if (this.narrationEl) this.narrationEl.currentTime = 0;
    if (this.musicEl) this.musicEl.currentTime = 0;
    this.emit({ status: "idle" });
  }

  dispose() {
    this.stop();
    try {
      this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.narrationEl = null;
    this.musicEl = null;
    this.sfxEls = [];
    this.narrationGain = null;
    this.musicGain = null;
    this.analyser = null;
    this.listeners.clear();
  }

  private async ensureGraph(): Promise<void> {
    if (this.ctx) return;
    this.emit({ status: "loading" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;

    // Soft-limiter master compressor prevents clipping.
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -3;
    master.knee.value = 6;
    master.ratio.value = 8;
    master.attack.value = 0.003;
    master.release.value = 0.15;
    master.connect(ctx.destination);

    if (this.inputs.narrationUrl) {
      const el = new Audio(this.inputs.narrationUrl);
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      this.narrationEl = el;
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = clamp(this.inputs.narrationVolume ?? 1);
      src.connect(gain).connect(master);
      this.narrationGain = gain;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyserBuf = new Uint8Array(this.analyser.fftSize);
      src.connect(this.analyser);
    }
    if (this.inputs.musicUrl) {
      const el = new Audio(this.inputs.musicUrl);
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.loop = true;
      this.musicEl = el;
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = clamp(this.inputs.musicVolume ?? 0.25);
      src.connect(gain).connect(master);
      this.musicGain = gain;
    }
    for (const url of this.inputs.sfxUrls ?? []) {
      if (!url) continue;
      const el = new Audio(url);
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = clamp(this.inputs.sfxVolume ?? 0.35);
      src.connect(gain).connect(master);
      this.sfxEls.push(el);
    }
  }

  private tick = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    const primary = this.narrationEl ?? this.musicEl;
    if (primary) {
      const dur = Number.isFinite(primary.duration) ? primary.duration : 0;
      this.emit({ status: "playing", mode: this.mode, positionSec: primary.currentTime, durationSec: dur });
      if (primary === this.narrationEl && primary.ended && this.mode !== "music") {
        this.stop();
        return;
      }
    }
    // Ducking — only in mix mode with both tracks.
    if (
      this.mode === "mix" &&
      this.analyser &&
      this.analyserBuf &&
      this.musicGain &&
      this.narrationEl
    ) {
      this.analyser.getByteTimeDomainData(this.analyserBuf);
      let sum = 0;
      for (let i = 0; i < this.analyserBuf.length; i++) {
        const v = (this.analyserBuf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.analyserBuf.length);
      const threshold = this.inputs.duckThreshold ?? 0.05;
      const duckedLevel = clamp(this.inputs.duckedLevel ?? 0.15);
      const musicVol = clamp(this.inputs.musicVolume ?? 0.25);
      const speaking = rms > threshold;
      const target = speaking ? musicVol * duckedLevel : musicVol;
      const rampMs = speaking ? this.inputs.attackMs ?? 120 : this.inputs.releaseMs ?? 400;
      try {
        this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
        this.musicGain.gain.linearRampToValueAtTime(target, ctx.currentTime + rampMs / 1000);
      } catch {
        /* ignore */
      }
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}

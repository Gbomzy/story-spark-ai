// Client-side movie composer: stitches scene clips into a single video blob
// using <canvas> + <video> + MediaRecorder. Runs entirely in the browser —
// no server round-trip, no ffmpeg dependency. Requires the source clip URLs
// to be CORS-readable (DashScope + Supabase storage return CORS headers, so
// the canvas remains untainted).

import type { MovieManifest, SceneClip } from "@/lib/pipelineEngine.functions";
import type { AudioStudioState } from "@/lib/storyMusic";

export type ComposerSettings = {
  resolution: "720p" | "1080p";
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:5";
  fps: 24 | 30 | 60;
  quality: "standard" | "high" | "ultra";
  transition: "cut" | "fade" | "crossfade" | "slide" | "dissolve";
  transitionDuration: number; // seconds
  burnSubtitles: boolean;
  subtitleText?: string; // plain narration text — segmented on the fly
  subtitleFontSize?: number;
  subtitleColor?: string;
  subtitleBackground?: string;
  subtitlePosition?: "bottom" | "top" | "middle";
  /** Optional background music mixed under narration. */
  backgroundMusicUrl?: string;
  /** 0..1 — gain applied to the background music track. */
  backgroundMusicVolume?: number;
  /** 0..1 — gain applied to the narration track. Default 1.0. */
  narrationVolume?: number;
  /** Optional per-scene Audio Studio configuration (BGM, SFX, ducking, credits). */
  audioStudio?: AudioStudioState;
};

export type ComposerProgress = (info: {
  stage: "loading" | "rendering" | "encoding" | "done";
  clip?: number;
  totalClips?: number;
  percent: number;
}) => void;

const RES_MAP: Record<ComposerSettings["resolution"], number> = { "720p": 720, "1080p": 1080 };
const QUALITY_BITRATE: Record<ComposerSettings["quality"], number> = {
  standard: 3_500_000,
  high: 6_000_000,
  ultra: 10_000_000,
};

function dimensions(s: ComposerSettings): { w: number; h: number } {
  const short = RES_MAP[s.resolution];
  switch (s.aspectRatio) {
    case "16:9":
      return { w: Math.round((short * 16) / 9), h: short };
    case "9:16":
      return { w: short, h: Math.round((short * 16) / 9) };
    case "1:1":
      return { w: short, h: short };
    case "4:5":
      return { w: short, h: Math.round((short * 5) / 4) };
  }
}

function pickMimeType(): { mime: string; ext: "webm" | "mp4" } {
  const candidates: Array<{ mime: string; ext: "webm" | "mp4" }> = [
    { mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: "video/webm", ext: "webm" };
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    const onReady = () => resolve(v);
    v.addEventListener("loadeddata", onReady, { once: true });
    v.addEventListener("error", () => reject(new Error(`Failed to load ${url}`)), { once: true });
  });
}

function loadAudio(url: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = "auto";
    a.src = url;
    a.addEventListener("loadeddata", () => resolve(a), { once: true });
    a.addEventListener("error", () => reject(new Error(`Failed to load audio ${url}`)), {
      once: true,
    });
  });
}

function drawFit(
  ctx: CanvasRenderingContext2D,
  v: HTMLVideoElement,
  w: number,
  h: number,
  alpha = 1,
) {
  const vw = v.videoWidth || w;
  const vh = v.videoHeight || h;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(v, dx, dy, dw, dh);
  ctx.restore();
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
  s: ComposerSettings,
) {
  if (!text) return;
  const fontSize = s.subtitleFontSize ?? Math.round(h * 0.04);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padding = Math.round(fontSize * 0.6);
  const maxWidth = w * 0.86;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const lineHeight = fontSize * 1.25;
  const blockHeight = lineHeight * lines.length + padding;
  const y0 =
    s.subtitlePosition === "top"
      ? padding + fontSize
      : s.subtitlePosition === "middle"
        ? (h - blockHeight) / 2 + fontSize
        : h - blockHeight - padding;
  // background band
  ctx.fillStyle = s.subtitleBackground ?? "rgba(0,0,0,0.55)";
  const bandY = y0 - fontSize * 0.75;
  ctx.fillRect(w * 0.05, bandY, w * 0.9, blockHeight);
  // text
  ctx.fillStyle = s.subtitleColor ?? "#ffffff";
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, y0 + i * lineHeight));
}

function segmentSubtitles(
  text: string,
  totalDuration: number,
): Array<{ start: number; end: number; text: string }> {
  if (!text || totalDuration <= 0) return [];
  const sentences = text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return [];
  const totalWords = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0);
  let t = 0;
  return sentences.map((s) => {
    const share = s.split(/\s+/).length / totalWords;
    const dur = share * totalDuration;
    const cue = { start: t, end: t + dur, text: s };
    t += dur;
    return cue;
  });
}

export async function composeMovie(
  manifest: MovieManifest,
  narrationUrl: string | undefined,
  settings: ComposerSettings,
  onProgress?: ComposerProgress,
): Promise<{ blob: Blob; ext: "webm" | "mp4"; mime: string; durationSeconds: number }> {
  if (!manifest.clips.length) throw new Error("No scene clips to compose.");
  const { w, h } = dimensions(settings);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  onProgress?.({ stage: "loading", percent: 0, totalClips: manifest.clips.length });

  // Preload every video in parallel. If any load fails (usually CORS),
  // throw so the caller can fall back to ZIP export.
  const videos: HTMLVideoElement[] = [];
  for (let i = 0; i < manifest.clips.length; i++) {
    const v = await loadVideo(manifest.clips[i].url);
    videos.push(v);
    onProgress?.({
      stage: "loading",
      clip: i + 1,
      totalClips: manifest.clips.length,
      percent: ((i + 1) / manifest.clips.length) * 20,
    });
  }

  // Optional narration → drives a WebAudio destination stream mixed into
  // the recorded output. If it fails to load, continue silently.
  let audioStream: MediaStream | undefined;
  let audioEl: HTMLAudioElement | undefined;
  let bgmEl: HTMLAudioElement | undefined;
  let audioCtx: AudioContext | undefined;
  // Audio Studio (v2) scheduling state.
  type SceneTiming = { sceneNumber: number; startSec: number; endSec: number };
  type SceneAudio = {
    timing: SceneTiming;
    bgmEl?: HTMLAudioElement;
    bgmGain?: GainNode;
    musicVolume: number;
    sfx: Array<{
      el: HTMLAudioElement;
      gain: GainNode;
      volume: number;
      startOffset: number;
      started: boolean;
    }>;
  };
  const sceneTimings: SceneTiming[] = (() => {
    const out: SceneTiming[] = [];
    let t = 0;
    // Group consecutive clips of the same scene.
    for (let i = 0; i < manifest.clips.length; i++) {
      const clip = manifest.clips[i];
      const dur = effectiveDuration(clip);
      const last = out[out.length - 1];
      if (last && last.sceneNumber === clip.sceneNumber) {
        last.endSec = t + dur;
      } else {
        out.push({ sceneNumber: clip.sceneNumber, startSec: t, endSec: t + dur });
      }
      t += dur;
    }
    return out;
  })();
  const sceneAudio: SceneAudio[] = [];
  let narrationAnalyser: AnalyserNode | undefined;
  let creditsEl: HTMLAudioElement | undefined;
  let creditsGain: GainNode | undefined;
  const audioStudio = settings.audioStudio;
  const useStudio = Boolean(audioStudio && audioStudio.scenes.length);
  if (narrationUrl || settings.backgroundMusicUrl || useStudio) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
      audioCtx = new AC();
      const dest = audioCtx.createMediaStreamDestination();
      // Silent monitor so playback still ticks without audible output.
      const silentMonitor = audioCtx.createGain();
      silentMonitor.gain.value = 0;
      silentMonitor.connect(audioCtx.destination);

      if (narrationUrl) {
        audioEl = await loadAudio(narrationUrl);
        const narrSrc = audioCtx.createMediaElementSource(audioEl);
        const narrGain = audioCtx.createGain();
        // Per-scene narration volume overrides the global setting when the
        // Audio Studio is active; the scheduler ramps this gain per scene.
        narrGain.gain.value = Math.max(0, Math.min(1, settings.narrationVolume ?? 1));
        narrSrc.connect(narrGain).connect(dest);
        narrSrc.connect(silentMonitor);
        if (useStudio) {
          narrationAnalyser = audioCtx.createAnalyser();
          narrationAnalyser.fftSize = 512;
          narrSrc.connect(narrationAnalyser);
        }
      }

      if (!useStudio && settings.backgroundMusicUrl) {
        try {
          bgmEl = await loadAudio(settings.backgroundMusicUrl);
          bgmEl.loop = true;
          const bgmSrc = audioCtx.createMediaElementSource(bgmEl);
          const bgmGain = audioCtx.createGain();
          bgmGain.gain.value = Math.max(0, Math.min(1, settings.backgroundMusicVolume ?? 0.2));
          bgmSrc.connect(bgmGain).connect(dest);
          bgmSrc.connect(silentMonitor);
        } catch {
          bgmEl = undefined;
        }
      }

      if (useStudio && audioStudio) {
        // Preload per-scene BGM + SFX. Missing URLs are silently skipped.
        for (const timing of sceneTimings) {
          const cfg = audioStudio.scenes.find((s) => s.sceneNumber === timing.sceneNumber);
          const entry: SceneAudio = {
            timing,
            musicVolume: cfg?.musicVolume ?? 0.2,
            sfx: [],
          };
          if (cfg?.bgmTrackUrl) {
            try {
              const el = await loadAudio(cfg.bgmTrackUrl);
              el.loop = true;
              const src = audioCtx.createMediaElementSource(el);
              const gain = audioCtx.createGain();
              gain.gain.value = 0; // ramped up when scene starts
              src.connect(gain).connect(dest);
              src.connect(silentMonitor);
              entry.bgmEl = el;
              entry.bgmGain = gain;
            } catch {
              /* skip missing track */
            }
          }
          if (cfg?.sfx?.length) {
            for (const s of cfg.sfx) {
              if (!s.url) continue;
              try {
                const el = await loadAudio(s.url);
                const src = audioCtx.createMediaElementSource(el);
                const gain = audioCtx.createGain();
                gain.gain.value = Math.max(0, Math.min(1, s.volume));
                src.connect(gain).connect(dest);
                src.connect(silentMonitor);
                entry.sfx.push({
                  el,
                  gain,
                  volume: s.volume,
                  startOffset: s.startOffset ?? 0,
                  started: false,
                });
              } catch {
                /* skip */
              }
            }
          }
          sceneAudio.push(entry);
        }
        // Ending credits track (optional).
        const ec = audioStudio.endingCredits;
        if (ec?.enabled && ec.trackUrl) {
          try {
            creditsEl = await loadAudio(ec.trackUrl);
            const src = audioCtx.createMediaElementSource(creditsEl);
            creditsGain = audioCtx.createGain();
            creditsGain.gain.value = 0;
            src.connect(creditsGain).connect(dest);
            src.connect(silentMonitor);
          } catch {
            creditsEl = undefined;
          }
        }
      }

      audioStream = dest.stream;
    } catch {
      audioStream = undefined;
    }
  }

  const canvasStream = canvas.captureStream(settings.fps);
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioStream) tracks.push(...audioStream.getAudioTracks());
  const combined = new MediaStream(tracks);

  const { mime, ext } = pickMimeType();
  const recorder = new MediaRecorder(combined, {
    mimeType: mime,
    videoBitsPerSecond: QUALITY_BITRATE[settings.quality],
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  const totalDuration = manifest.clips.reduce((n, c) => n + effectiveDuration(c), 0);
  const cues =
    settings.burnSubtitles && settings.subtitleText
      ? segmentSubtitles(settings.subtitleText, totalDuration)
      : [];

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(200);
  if (audioEl)
    audioEl.play().catch(() => {
      /* ignore */
    });
  if (bgmEl)
    bgmEl.play().catch(() => {
      /* ignore */
    });
  const startedAt = performance.now();

  // Audio Studio scheduler — runs alongside the rAF render loop.
  let schedulerRaf: number | null = null;
  const analyserBuf = narrationAnalyser ? new Uint8Array(narrationAnalyser.fftSize) : null;
  if (useStudio && audioStudio && audioCtx) {
    const ducking = audioStudio.ducking;
    const ecFade = audioStudio.endingCredits?.enabled
      ? audioStudio.endingCredits.fadeOutSeconds
      : 0;
    const totalSec = sceneTimings.length ? sceneTimings[sceneTimings.length - 1].endSec : 0;
    const scheduler = () => {
      const now = performance.now();
      const elapsed = (now - startedAt) / 1000;
      // Determine narration RMS (0..1) for ducking.
      let rms = 0;
      if (narrationAnalyser && analyserBuf) {
        narrationAnalyser.getByteTimeDomainData(analyserBuf);
        let sum = 0;
        for (let i = 0; i < analyserBuf.length; i++) {
          const v = (analyserBuf[i] - 128) / 128;
          sum += v * v;
        }
        rms = Math.sqrt(sum / analyserBuf.length);
      }
      const speaking = ducking.enabled && rms > ducking.threshold;
      for (const entry of sceneAudio) {
        const active = elapsed >= entry.timing.startSec && elapsed < entry.timing.endSec;
        if (active && entry.bgmEl && entry.bgmEl.paused) {
          entry.bgmEl.play().catch(() => {
            /* ignore */
          });
        }
        if (entry.bgmGain) {
          const target = !active
            ? 0
            : speaking
              ? ducking.duckedLevel * entry.musicVolume
              : entry.musicVolume;
          const rampMs = speaking ? ducking.attackMs : ducking.releaseMs;
          const t = audioCtx!.currentTime + Math.max(0.02, rampMs / 1000);
          try {
            entry.bgmGain.gain.cancelScheduledValues(audioCtx!.currentTime);
            entry.bgmGain.gain.linearRampToValueAtTime(target, t);
          } catch {
            /* ignore */
          }
        }
        // Fire SFX one-shots.
        for (const s of entry.sfx) {
          if (!s.started && active && elapsed >= entry.timing.startSec + s.startOffset) {
            s.started = true;
            s.el.currentTime = 0;
            s.el.play().catch(() => {
              /* ignore */
            });
          }
        }
      }
      // Ending credits fade-out on the master audio: ramp all scene BGM to 0
      // and fade in the credits track over `fadeOutSeconds`.
      if (ecFade > 0 && creditsGain && creditsEl && totalSec > 0) {
        const fadeStart = totalSec - ecFade;
        if (elapsed >= fadeStart && creditsEl.paused)
          creditsEl.play().catch(() => {
            /* ignore */
          });
        if (elapsed >= fadeStart) {
          const t = Math.min(1, (elapsed - fadeStart) / ecFade);
          try {
            creditsGain.gain.cancelScheduledValues(audioCtx!.currentTime);
            creditsGain.gain.linearRampToValueAtTime(t, audioCtx!.currentTime + 0.05);
          } catch {
            /* ignore */
          }
        }
      }
      schedulerRaf = requestAnimationFrame(scheduler);
    };
    schedulerRaf = requestAnimationFrame(scheduler);
  }

  onProgress?.({ stage: "rendering", percent: 20, totalClips: manifest.clips.length });

  const transDur = settings.transition === "cut" ? 0 : Math.max(0, settings.transitionDuration);

  for (let i = 0; i < manifest.clips.length; i++) {
    const clip = manifest.clips[i];
    const video = videos[i];
    const nextVideo = videos[i + 1];
    const dur = effectiveDuration(clip);
    video.currentTime = clip.trimStart ?? 0;
    await video.play().catch(() => {
      /* ignore autoplay quirks */
    });

    const clipStart = performance.now();
    const clipEndMs = clipStart + dur * 1000;
    // Render frames until dur elapsed. Use rAF to stay smooth.
    await new Promise<void>((resolve) => {
      const tick = () => {
        const now = performance.now();
        if (now >= clipEndMs) {
          resolve();
          return;
        }
        // Fade in for first clip
        if (
          i === 0 &&
          transDur > 0 &&
          (settings.transition === "fade" ||
            settings.transition === "crossfade" ||
            settings.transition === "dissolve")
        ) {
          const t = Math.min(1, (now - clipStart) / (transDur * 1000));
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, w, h);
          drawFit(ctx, video, w, h, t);
        } else {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, w, h);
          drawFit(ctx, video, w, h, 1);
        }
        // Crossfade into next clip during last `transDur` seconds
        if (
          nextVideo &&
          transDur > 0 &&
          (settings.transition === "crossfade" || settings.transition === "dissolve")
        ) {
          const remaining = (clipEndMs - now) / 1000;
          if (remaining < transDur) {
            const t = 1 - remaining / transDur;
            // Kick off next clip playback silently
            if (nextVideo.paused) {
              nextVideo.currentTime = manifest.clips[i + 1].trimStart ?? 0;
              nextVideo.play().catch(() => {
                /* ignore */
              });
            }
            drawFit(ctx, nextVideo, w, h, t);
          }
        } else if (settings.transition === "slide" && nextVideo) {
          const remaining = (clipEndMs - now) / 1000;
          if (remaining < transDur) {
            const t = 1 - remaining / transDur;
            if (nextVideo.paused) {
              nextVideo.currentTime = manifest.clips[i + 1].trimStart ?? 0;
              nextVideo.play().catch(() => {
                /* ignore */
              });
            }
            ctx.save();
            ctx.translate(w * (1 - t), 0);
            drawFit(ctx, nextVideo, w, h, 1);
            ctx.restore();
          }
        }
        // Fade out for last clip
        if (
          !nextVideo &&
          transDur > 0 &&
          (settings.transition === "fade" ||
            settings.transition === "crossfade" ||
            settings.transition === "dissolve")
        ) {
          const remaining = (clipEndMs - now) / 1000;
          if (remaining < transDur) {
            const t = remaining / transDur;
            ctx.fillStyle = `rgba(0,0,0,${1 - t})`;
            ctx.fillRect(0, 0, w, h);
          }
        }
        // Subtitle overlay
        if (cues.length > 0) {
          const elapsed = (now - startedAt) / 1000;
          const cue = cues.find((c) => elapsed >= c.start && elapsed < c.end);
          if (cue) drawSubtitle(ctx, cue.text, w, h, settings);
        }
        const totalElapsed = (now - startedAt) / 1000;
        const pct = 20 + Math.min(70, (totalElapsed / totalDuration) * 70);
        onProgress?.({
          stage: "rendering",
          clip: i + 1,
          totalClips: manifest.clips.length,
          percent: pct,
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  }

  onProgress?.({ stage: "encoding", percent: 95 });
  recorder.stop();
  await stopped;
  if (schedulerRaf != null) cancelAnimationFrame(schedulerRaf);
  for (const s of sceneAudio) {
    try {
      s.bgmEl?.pause();
    } catch {
      /* ignore */
    }
    for (const x of s.sfx) {
      try {
        x.el.pause();
      } catch {
        /* ignore */
      }
    }
  }
  if (creditsEl) {
    try {
      creditsEl.pause();
    } catch {
      /* ignore */
    }
  }
  if (audioEl) {
    try {
      audioEl.pause();
    } catch {
      /* ignore */
    }
  }
  if (bgmEl) {
    try {
      bgmEl.pause();
    } catch {
      /* ignore */
    }
  }
  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch {
      /* ignore */
    }
  }
  const blob = new Blob(chunks, { type: mime });
  onProgress?.({ stage: "done", percent: 100 });
  return { blob, ext, mime, durationSeconds: totalDuration };
}

function effectiveDuration(c: SceneClip): number {
  return Math.max(0.5, c.durationSeconds - (c.trimStart ?? 0) - (c.trimEnd ?? 0));
}

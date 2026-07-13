import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Mic, Music as MusicIcon, Layers, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { AudioMixer, type PreviewMixerState, type PreviewMode } from "@/lib/audioMixer";
import { validateAudio, type AudioValidationReport } from "@/lib/audioValidator";
import type { AudioStudioState } from "@/lib/storyMusic";

type Props = {
  narrationUrl?: string;
  musicUrl?: string;
  audioStudio?: AudioStudioState;
  narrationText?: string;
  narrationVolume?: number;
  musicVolume?: number;
};

export function AudioStudioPreview(props: Props) {
  const mixerRef = useRef<AudioMixer | null>(null);
  const [state, setState] = useState<PreviewMixerState>({ status: "idle" });
  const [activeMode, setActiveMode] = useState<PreviewMode | null>(null);

  const musicUrl = useMemo(() => {
    if (props.musicUrl) return props.musicUrl;
    return props.audioStudio?.scenes.find((s) => s.bgmTrackUrl)?.bgmTrackUrl;
  }, [props.musicUrl, props.audioStudio]);

  useEffect(() => {
    const m = new AudioMixer();
    mixerRef.current = m;
    const unsub = m.subscribe(setState);
    return () => {
      unsub();
      m.dispose();
      mixerRef.current = null;
    };
  }, []);

  useEffect(() => {
    mixerRef.current?.setInputs({
      narrationUrl: props.narrationUrl,
      musicUrl,
      narrationVolume: props.narrationVolume ?? 1,
      musicVolume: props.musicVolume ?? 0.25,
      sfxVolume: 0.35,
      duckedLevel: props.audioStudio?.ducking.duckedLevel ?? 0.15,
      duckThreshold: props.audioStudio?.ducking.threshold ?? 0.05,
      attackMs: props.audioStudio?.ducking.attackMs ?? 120,
      releaseMs: props.audioStudio?.ducking.releaseMs ?? 400,
    });
  }, [props.narrationUrl, musicUrl, props.narrationVolume, props.musicVolume, props.audioStudio]);

  const report: AudioValidationReport = useMemo(
    () =>
      validateAudio({
        narrationUrl: props.narrationUrl,
        audioStudio: props.audioStudio,
        narrationText: props.narrationText,
      }),
    [props.narrationUrl, props.audioStudio, props.narrationText],
  );

  const toggle = (mode: PreviewMode) => {
    const m = mixerRef.current;
    if (!m) return;
    if (activeMode === mode && state.status === "playing") {
      m.pause();
      return;
    }
    if (activeMode !== mode) m.stop();
    setActiveMode(mode);
    void m.play(mode);
  };

  const disabledMix = !props.narrationUrl && !musicUrl;

  return (
    <Card className="glass rounded-2xl p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Audio Preview</p>
          <p className="text-[11px] text-muted-foreground">
            Narration, music, or the final mix — with automatic ducking.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            report.ok
              ? "rounded-full text-[10px] uppercase tracking-wider text-emerald-600"
              : "rounded-full text-[10px] uppercase tracking-wider text-amber-600"
          }
        >
          {report.ok ? "Ready" : "Review"}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <PreviewButton
          icon={<Mic className="h-4 w-4" />}
          label="Narration"
          active={activeMode === "narration" && state.status === "playing"}
          disabled={!props.narrationUrl}
          onClick={() => toggle("narration")}
        />
        <PreviewButton
          icon={<MusicIcon className="h-4 w-4" />}
          label="Music"
          active={activeMode === "music" && state.status === "playing"}
          disabled={!musicUrl}
          onClick={() => toggle("music")}
        />
        <PreviewButton
          icon={<Layers className="h-4 w-4" />}
          label="Final mix"
          active={activeMode === "mix" && state.status === "playing"}
          disabled={disabledMix}
          onClick={() => toggle("mix")}
        />
      </div>

      {state.status === "playing" || state.status === "paused" ? (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {state.mode} · {Math.floor(state.positionSec)}s
          {state.durationSec ? ` / ${Math.floor(state.durationSec)}s` : ""}
        </div>
      ) : null}

      <div className="mt-4 space-y-1">
        {report.checks.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-[11px]">
            {c.status === "pass" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500" />
            ) : c.status === "warn" ? (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 text-red-500" />
            )}
            <div className="flex-1">
              <span className="font-medium">{c.label}</span>
              {c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PreviewButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="h-9 rounded-lg text-xs"
    >
      {active ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
      <span className="mr-1">{icon}</span>
      {label}
    </Button>
  );
}

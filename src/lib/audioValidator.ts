// End-to-end audio validation. Runs cheap in-browser checks against a
// composed Audio Studio state + narration URL so the user gets a
// pre-flight report before rendering the movie.

import type { AudioStudioState } from "@/lib/storyMusic";

export type AudioCheck = {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail?: string;
};

export type AudioValidationReport = {
  ok: boolean;
  checks: AudioCheck[];
};

export type ValidationInputs = {
  narrationUrl?: string;
  audioStudio?: AudioStudioState;
  narrationText?: string;
};

function pass(id: string, label: string, detail?: string): AudioCheck {
  return { id, label, status: "pass", detail };
}
function warn(id: string, label: string, detail?: string): AudioCheck {
  return { id, label, status: "warn", detail };
}
function fail(id: string, label: string, detail?: string): AudioCheck {
  return { id, label, status: "fail", detail };
}

export function validateAudio(inputs: ValidationInputs): AudioValidationReport {
  const checks: AudioCheck[] = [];

  // 1. Narration present & non-trivial.
  if (!inputs.narrationUrl) {
    checks.push(fail("narration.url", "Narration audio available"));
  } else {
    checks.push(pass("narration.url", "Narration audio available"));
  }
  if (inputs.narrationText && inputs.narrationText.trim().length > 40) {
    checks.push(pass("narration.text", "Narration script is expressive-length"));
  } else {
    checks.push(warn("narration.text", "Narration script is short", "Under 40 characters"));
  }

  const s = inputs.audioStudio;
  if (!s || !s.scenes.length) {
    checks.push(warn("scenes", "Scene-level music configured", "No Audio Studio scenes found"));
    return { ok: checks.every((c) => c.status !== "fail"), checks };
  }

  // 2. Continuous music coverage.
  const missingMusic = s.scenes.filter((sc) => !sc.bgmTrackUrl);
  if (missingMusic.length === 0) {
    checks.push(pass("music.continuity", "Every scene has background music"));
  } else if (missingMusic.length < s.scenes.length) {
    checks.push(
      warn(
        "music.continuity",
        "Some scenes have no music",
        `${missingMusic.length}/${s.scenes.length} scenes missing a track`,
      ),
    );
  } else {
    checks.push(fail("music.continuity", "No scene has music", "Long silent sections likely"));
  }

  // 3. Ducking configured.
  if (s.ducking.enabled && s.ducking.duckedLevel <= 0.4) {
    checks.push(pass("ducking", "Ducking will lower music under narration"));
  } else if (!s.ducking.enabled) {
    checks.push(warn("ducking", "Ducking disabled", "Music may overpower narration"));
  } else {
    checks.push(warn("ducking", "Ducking level is high", `duckedLevel=${s.ducking.duckedLevel.toFixed(2)}`));
  }

  // 4. Volume sanity — prevent clipping.
  const loudScenes = s.scenes.filter((sc) => sc.narrationVolume + sc.musicVolume > 1.4);
  if (loudScenes.length) {
    checks.push(
      warn(
        "clipping",
        "Combined loudness may clip",
        `${loudScenes.length} scene(s) exceed 1.4× sum`,
      ),
    );
  } else {
    checks.push(pass("clipping", "Combined loudness within safe range"));
  }

  // 5. Ending credits fade.
  if (s.endingCredits.enabled) {
    if (s.endingCredits.fadeOutSeconds >= 2) {
      checks.push(pass("credits.fade", "Ending credits fade is smooth"));
    } else {
      checks.push(
        warn(
          "credits.fade",
          "Ending credits fade is short",
          `${s.endingCredits.fadeOutSeconds}s (recommend ≥2s)`,
        ),
      );
    }
  } else {
    checks.push(warn("credits.fade", "Ending credits disabled", "Movie will end abruptly"));
  }

  // 6. Scene transitions — check that scene volumes are similar (< 0.4 delta).
  let jumps = 0;
  for (let i = 1; i < s.scenes.length; i++) {
    if (Math.abs(s.scenes[i].musicVolume - s.scenes[i - 1].musicVolume) > 0.4) jumps++;
  }
  if (jumps === 0) checks.push(pass("transitions", "Scene music transitions are smooth"));
  else
    checks.push(
      warn("transitions", "Large volume jumps between scenes", `${jumps} scene boundary jumps`),
    );

  return { ok: checks.every((c) => c.status !== "fail"), checks };
}

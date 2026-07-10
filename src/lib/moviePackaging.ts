// Client-side movie packaging: bundle a project's media + metadata into a ZIP.
import JSZip from "jszip";
import { saveAs } from "file-saver";

export interface PackageOptions {
  name: string;
  project: Record<string, unknown>;
  videoUrl?: string | null;
  narrationUrl?: string | null;
  subtitles?: string | null;
  subtitleFormat?: "srt" | "vtt" | "txt";
  images?: Array<{ id: string; url: string }>;
}

function safeName(s: string): string {
  return s.replace(/[^a-z0-9-_ ]/gi, "_").trim() || "movie";
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

export async function packageMovie(opts: PackageOptions): Promise<Blob> {
  const zip = new JSZip();
  const base = safeName(opts.name);
  zip.file("project.json", JSON.stringify(opts.project, null, 2));
  zip.file(
    "metadata.json",
    JSON.stringify(
      {
        name: opts.name,
        generated_at: new Date().toISOString(),
        provider: "Alibaba Cloud (Qwen / Wan / CosyVoice)",
        assets: {
          video: Boolean(opts.videoUrl),
          narration: Boolean(opts.narrationUrl),
          subtitles: Boolean(opts.subtitles),
          images: opts.images?.length ?? 0,
        },
      },
      null,
      2,
    ),
  );

  if (opts.videoUrl) {
    const b = await fetchAsBlob(opts.videoUrl);
    if (b) zip.file(`${base}.mp4`, b);
  }
  if (opts.narrationUrl) {
    const b = await fetchAsBlob(opts.narrationUrl);
    if (b) zip.file(`${base}-narration.mp3`, b);
  }
  if (opts.subtitles) {
    zip.file(`${base}.${opts.subtitleFormat ?? "srt"}`, opts.subtitles);
  }
  if (opts.images?.length) {
    const dir = zip.folder("images")!;
    let i = 0;
    for (const img of opts.images) {
      const b = await fetchAsBlob(img.url);
      if (b) dir.file(`${String(++i).padStart(3, "0")}-${safeName(img.id)}.png`, b);
    }
  }

  return zip.generateAsync({ type: "blob" });
}

export async function downloadMoviePackage(opts: PackageOptions): Promise<void> {
  const blob = await packageMovie(opts);
  saveAs(blob, `${safeName(opts.name)}-movie.zip`);
}
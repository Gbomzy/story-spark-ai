// Media pipeline definition — shared across Media Studio, Video Studio and services.
// Represents the full Story → Video workflow used by Wan (and future providers).

export type PipelineStatus = "pending" | "generating" | "completed" | "failed";

export type PipelineStageId =
  | "story"
  | "characters"
  | "storyboard"
  | "voice_script"
  | "songs"
  | "image_prompts"
  | "generated_images"
  | "narration"
  | "music"
  | "subtitles"
  | "thumbnail"
  | "video";

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  description: string;
  /** Column on the projects row that holds the source content for this stage. */
  sourceField?: string;
  /** Column that stores the generated asset (JSON blob / text). */
  assetField?: string;
  /** True when the stage produces a downloadable binary media file. */
  isMedia: boolean;
  /** True while no provider is connected. */
  comingSoon: boolean;
};

export const PIPELINE: PipelineStage[] = [
  { id: "story", label: "Story", description: "Written narrative", sourceField: "story", assetField: "story", isMedia: false, comingSoon: false },
  { id: "characters", label: "Characters", description: "Cast & personalities", sourceField: "characters", assetField: "characters", isMedia: false, comingSoon: false },
  { id: "storyboard", label: "Storyboard", description: "Scene breakdown", sourceField: "storyboard", assetField: "storyboard", isMedia: false, comingSoon: false },
  { id: "voice_script", label: "Voice Script", description: "Narration script", sourceField: "voice", assetField: "voice", isMedia: false, comingSoon: false },
  { id: "songs", label: "Songs", description: "Original lyrics", sourceField: "songs", assetField: "songs", isMedia: false, comingSoon: false },
  { id: "image_prompts", label: "Image Prompts", description: "Prompts per scene", sourceField: "images", assetField: "images", isMedia: false, comingSoon: false },
  { id: "generated_images", label: "Images", description: "Rendered scene stills", sourceField: "images", assetField: "generated_images", isMedia: true, comingSoon: false },
  { id: "narration", label: "Narration", description: "Voice-over MP3", sourceField: "voice", assetField: "voice_audio", isMedia: true, comingSoon: false },
  { id: "music", label: "Music", description: "Background song MP3", sourceField: "songs", assetField: "background_music", isMedia: true, comingSoon: true },
  { id: "subtitles", label: "Subtitles", description: "SRT captions", sourceField: "voice", assetField: "subtitle_file", isMedia: true, comingSoon: false },
  { id: "thumbnail", label: "Thumbnail", description: "Cover image", sourceField: "story", assetField: "thumbnail", isMedia: true, comingSoon: false },
  { id: "video", label: "Video", description: "Final MP4 render", assetField: "video_file", isMedia: true, comingSoon: false },
];

/** Ordered flow shown as a workflow diagram in the UI. */
export const PIPELINE_FLOW: PipelineStageId[] = [
  "story",
  "characters",
  "storyboard",
  "generated_images",
  "narration",
  "music",
  "video",
];

export type PipelineState = Partial<Record<PipelineStageId, PipelineStatus>>;

export function stageStatus(project: Record<string, unknown> | null | undefined, stage: PipelineStage): PipelineStatus {
  if (!project) return "pending";
  const stored = (project.media_pipeline as PipelineState | null | undefined)?.[stage.id];
  if (stored) return stored;
  const val = stage.assetField ? project[stage.assetField] : undefined;
  if (val && (typeof val === "string" ? val.trim().length > 0 : true)) return "completed";
  return "pending";
}
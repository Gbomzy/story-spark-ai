
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS generated_images jsonb,
  ADD COLUMN IF NOT EXISTS voice_audio jsonb,
  ADD COLUMN IF NOT EXISTS background_music jsonb,
  ADD COLUMN IF NOT EXISTS subtitle_file jsonb,
  ADD COLUMN IF NOT EXISTS thumbnail jsonb,
  ADD COLUMN IF NOT EXISTS video_file jsonb,
  ADD COLUMN IF NOT EXISTS video_provider text,
  ADD COLUMN IF NOT EXISTS render_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS render_progress integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS render_duration integer,
  ADD COLUMN IF NOT EXISTS media_pipeline jsonb;

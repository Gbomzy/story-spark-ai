ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS audio text,
  ADD COLUMN IF NOT EXISTS music text,
  ADD COLUMN IF NOT EXISTS video text,
  ADD COLUMN IF NOT EXISTS image_assets text;
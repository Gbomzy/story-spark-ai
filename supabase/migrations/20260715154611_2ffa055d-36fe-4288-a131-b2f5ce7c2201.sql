
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS render_heartbeat timestamptz,
  ADD COLUMN IF NOT EXISTS render_control text,
  ADD COLUMN IF NOT EXISTS render_error text,
  ADD COLUMN IF NOT EXISTS render_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_projects_render_status ON public.projects(user_id, render_status);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'projects'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projects';
  END IF;
END $$;

ALTER TABLE public.projects REPLICA IDENTITY FULL;

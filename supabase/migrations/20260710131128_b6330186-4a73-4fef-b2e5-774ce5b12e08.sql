
CREATE TABLE public.publish_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  account_name TEXT,
  account_id TEXT,
  scopes TEXT[],
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_connections TO authenticated;
GRANT ALL ON public.publish_connections TO service_role;
ALTER TABLE public.publish_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connections" ON public.publish_connections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.publish_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,
  platform TEXT NOT NULL,
  external_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  title TEXT,
  description TEXT,
  tags TEXT[],
  hashtags TEXT[],
  thumbnail_url TEXT,
  video_url TEXT,
  visibility TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_history TO authenticated;
GRANT ALL ON public.publish_history TO service_role;
ALTER TABLE public.publish_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history" ON public.publish_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_publish_connections_updated
  BEFORE UPDATE ON public.publish_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_publish_history_updated
  BEFORE UPDATE ON public.publish_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_publish_history_user_created ON public.publish_history (user_id, created_at DESC);
CREATE INDEX idx_publish_connections_user ON public.publish_connections (user_id);


-- ============ project_assets ============
CREATE TABLE public.project_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  asset_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  provider TEXT,
  active_version_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_assets_project ON public.project_assets(project_id);
CREATE INDEX idx_project_assets_user ON public.project_assets(user_id);
CREATE INDEX idx_project_assets_type ON public.project_assets(asset_type);
CREATE INDEX idx_project_assets_status ON public.project_assets(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assets TO authenticated;
GRANT ALL ON public.project_assets TO service_role;
ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets owner all" ON public.project_assets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_project_assets_updated BEFORE UPDATE ON public.project_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ asset_versions ============
CREATE TABLE public.asset_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.project_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  name TEXT,
  content TEXT,
  payload JSONB,
  provider TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_asset_versions_asset ON public.asset_versions(asset_id);
CREATE INDEX idx_asset_versions_user ON public.asset_versions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_versions TO authenticated;
GRANT ALL ON public.asset_versions TO service_role;
ALTER TABLE public.asset_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions owner all" ON public.asset_versions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_asset_versions_updated BEFORE UPDATE ON public.asset_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ generation_history ============
CREATE TABLE public.generation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.project_assets(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  duration_ms INTEGER,
  credits_used INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gen_history_user ON public.generation_history(user_id, created_at DESC);
CREATE INDEX idx_gen_history_project ON public.generation_history(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_history TO authenticated;
GRANT ALL ON public.generation_history TO service_role;
ALTER TABLE public.generation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history owner all" ON public.generation_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ generation_queue ============
CREATE TABLE public.generation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  estimated_seconds INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_queue_user_status ON public.generation_queue(user_id, status);
CREATE INDEX idx_queue_project ON public.generation_queue(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_queue TO authenticated;
GRANT ALL ON public.generation_queue TO service_role;
ALTER TABLE public.generation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue owner all" ON public.generation_queue FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_queue_updated BEFORE UPDATE ON public.generation_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Extensions for background scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- render_jobs: durable, worker-friendly queue for movie renders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','paused','completed','failed','cancelled','stalled')),
  mode text NOT NULL DEFAULT 'balanced'
    CHECK (mode IN ('eco','balanced','turbo')),
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  worker_id text,
  locked_until timestamptz,
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.render_jobs TO authenticated;
GRANT ALL ON public.render_jobs TO service_role;

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their render jobs"
  ON public.render_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS render_jobs_status_priority_idx
  ON public.render_jobs (status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS render_jobs_project_idx
  ON public.render_jobs (project_id);
CREATE INDEX IF NOT EXISTS render_jobs_user_idx
  ON public.render_jobs (user_id);
CREATE INDEX IF NOT EXISTS render_jobs_locked_until_idx
  ON public.render_jobs (locked_until) WHERE status = 'running';

-- updated_at trigger (reuses existing helper)
DROP TRIGGER IF EXISTS render_jobs_set_updated_at ON public.render_jobs;
CREATE TRIGGER render_jobs_set_updated_at
  BEFORE UPDATE ON public.render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.render_jobs;

-- ============================================================
-- claim_render_job: atomically lease one queued/stalled job
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_render_job(_worker_id text, _lease_seconds integer DEFAULT 120)
RETURNS SETOF public.render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job public.render_jobs%ROWTYPE;
BEGIN
  -- Reclaim leases that expired first, so they become claimable again.
  UPDATE public.render_jobs
     SET status = 'stalled', error = COALESCE(error, 'lease expired')
   WHERE status = 'running'
     AND locked_until IS NOT NULL
     AND locked_until < now();

  -- Pick one job: queued first, then stalled. Highest priority, oldest first.
  SELECT * INTO _job
    FROM public.render_jobs
   WHERE status IN ('queued','stalled')
   ORDER BY priority DESC, created_at ASC
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.render_jobs
     SET status = 'running',
         worker_id = _worker_id,
         locked_until = now() + make_interval(secs => GREATEST(30, _lease_seconds)),
         last_heartbeat_at = now(),
         started_at = COALESCE(started_at, now()),
         attempts = attempts + 1,
         error = NULL
   WHERE id = _job.id
   RETURNING * INTO _job;

  RETURN NEXT _job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_render_job(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_render_job(text, integer) TO service_role;

-- ============================================================
-- release_render_job: worker releases lease with an outcome
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_render_job(
  _job_id uuid,
  _worker_id text,
  _status text,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('queued','running','paused','completed','failed','cancelled','stalled') THEN
    RAISE EXCEPTION 'invalid status: %', _status;
  END IF;

  UPDATE public.render_jobs
     SET status = _status,
         worker_id = CASE WHEN _status IN ('completed','failed','cancelled') THEN NULL ELSE worker_id END,
         locked_until = CASE WHEN _status IN ('running','paused') THEN locked_until ELSE NULL END,
         last_heartbeat_at = now(),
         finished_at = CASE WHEN _status IN ('completed','failed','cancelled') THEN now() ELSE finished_at END,
         error = _error
   WHERE id = _job_id
     AND (worker_id = _worker_id OR worker_id IS NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.release_render_job(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_render_job(uuid, text, text, text) TO service_role;

-- ============================================================
-- reclaim_stalled_render_jobs: mark leases that expired as stalled
-- ============================================================
CREATE OR REPLACE FUNCTION public.reclaim_stalled_render_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  WITH upd AS (
    UPDATE public.render_jobs
       SET status = 'stalled',
           error = COALESCE(error, 'lease expired'),
           worker_id = NULL,
           locked_until = NULL
     WHERE status = 'running'
       AND locked_until IS NOT NULL
       AND locked_until < now() - interval '30 seconds'
     RETURNING 1
  )
  SELECT count(*) INTO _count FROM upd;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.reclaim_stalled_render_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stalled_render_jobs() TO service_role;

-- ============================================================
-- Trigger: keep render_jobs in sync with projects.render_status
-- Backward compatible with the existing in-browser pipeline that
-- writes to projects.render_status directly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_render_job_from_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job_status text;
  _project_owner uuid;
BEGIN
  IF NEW.render_status IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.render_status IS NOT DISTINCT FROM OLD.render_status THEN
    RETURN NEW;
  END IF;

  _job_status := CASE NEW.render_status
    WHEN 'queued' THEN 'queued'
    WHEN 'generating' THEN 'running'
    WHEN 'rendering' THEN 'running'
    WHEN 'processing' THEN 'running'
    WHEN 'paused' THEN 'paused'
    WHEN 'stalled' THEN 'stalled'
    WHEN 'completed' THEN 'completed'
    WHEN 'failed' THEN 'failed'
    WHEN 'cancelled' THEN 'cancelled'
    ELSE NULL
  END;

  IF _job_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Best-effort resolve owner: use NEW.user_id if column exists, else project owner column.
  _project_owner := NEW.user_id;

  -- Upsert the latest active job for this project, or create a fresh one if terminal state exists.
  INSERT INTO public.render_jobs (project_id, user_id, status, started_at, finished_at, last_heartbeat_at, error)
  SELECT NEW.id, _project_owner, _job_status,
         CASE WHEN _job_status = 'running' THEN COALESCE(NEW.render_started_at, now()) ELSE NULL END,
         CASE WHEN _job_status IN ('completed','failed','cancelled') THEN now() ELSE NULL END,
         now(),
         NEW.render_error
  WHERE NOT EXISTS (
    SELECT 1 FROM public.render_jobs
     WHERE project_id = NEW.id
       AND status NOT IN ('completed','failed','cancelled')
  );

  UPDATE public.render_jobs
     SET status = _job_status,
         last_heartbeat_at = now(),
         started_at = COALESCE(started_at, CASE WHEN _job_status = 'running' THEN now() ELSE NULL END),
         finished_at = CASE WHEN _job_status IN ('completed','failed','cancelled') THEN now() ELSE finished_at END,
         error = COALESCE(NEW.render_error, error)
   WHERE project_id = NEW.id
     AND status NOT IN ('completed','failed','cancelled');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_render_job_from_project ON public.projects;
CREATE TRIGGER trg_sync_render_job_from_project
  AFTER INSERT OR UPDATE OF render_status, render_error ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_render_job_from_project();

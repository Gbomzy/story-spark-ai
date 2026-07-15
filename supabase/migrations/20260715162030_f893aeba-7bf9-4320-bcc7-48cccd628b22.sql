
CREATE TABLE IF NOT EXISTS public.render_clip_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.render_jobs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scene_number integer NOT NULL,
  clip_number integer NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','starting','uploading','rendering','processing','saving','completed','failed','cancelled','paused','retrying','stalled')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  worker_id text,
  locked_until timestamptz,
  last_heartbeat_at timestamptz,
  provider text,
  model text,
  credits_charged integer,
  latency_ms integer,
  output_url text,
  cover_url text,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, scene_number, clip_number)
);

GRANT SELECT ON public.render_clip_jobs TO authenticated;
GRANT ALL ON public.render_clip_jobs TO service_role;

ALTER TABLE public.render_clip_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their clip jobs"
  ON public.render_clip_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS render_clip_jobs_job_status_idx
  ON public.render_clip_jobs (job_id, status);
CREATE INDEX IF NOT EXISTS render_clip_jobs_project_idx
  ON public.render_clip_jobs (project_id);
CREATE INDEX IF NOT EXISTS render_clip_jobs_locked_until_idx
  ON public.render_clip_jobs (locked_until) WHERE status IN ('starting','uploading','rendering','processing','saving');

DROP TRIGGER IF EXISTS render_clip_jobs_set_updated_at ON public.render_clip_jobs;
CREATE TRIGGER render_clip_jobs_set_updated_at
  BEFORE UPDATE ON public.render_clip_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.render_clip_jobs;

-- ============================================================
-- claim_next_clips: worker leases up to N pending clips for a job
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_clips(
  _job_id uuid,
  _worker_id text,
  _lease_seconds integer DEFAULT 120,
  _limit integer DEFAULT 1
)
RETURNS SETOF public.render_clip_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ids uuid[];
BEGIN
  SELECT array_agg(id) INTO _ids FROM (
    SELECT id
      FROM public.render_clip_jobs
     WHERE job_id = _job_id
       AND status IN ('queued','retrying','stalled')
     ORDER BY scene_number ASC, clip_number ASC
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(1, LEAST(_limit, 8))
  ) t;

  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE public.render_clip_jobs
       SET status = 'starting',
           worker_id = _worker_id,
           locked_until = now() + make_interval(secs => GREATEST(30, _lease_seconds)),
           last_heartbeat_at = now(),
           started_at = COALESCE(started_at, now()),
           attempts = attempts + 1,
           error = NULL
     WHERE id = ANY (_ids)
     RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_clips(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_clips(uuid, text, integer, integer) TO service_role;

-- ============================================================
-- release_clip_job: worker records the outcome
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_clip_job(
  _clip_id uuid,
  _worker_id text,
  _status text,
  _provider text DEFAULT NULL,
  _model text DEFAULT NULL,
  _output_url text DEFAULT NULL,
  _cover_url text DEFAULT NULL,
  _credits_charged integer DEFAULT NULL,
  _latency_ms integer DEFAULT NULL,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('queued','starting','uploading','rendering','processing','saving','completed','failed','cancelled','paused','retrying','stalled') THEN
    RAISE EXCEPTION 'invalid clip status: %', _status;
  END IF;

  UPDATE public.render_clip_jobs
     SET status = _status,
         worker_id = CASE WHEN _status IN ('completed','failed','cancelled') THEN NULL ELSE worker_id END,
         locked_until = CASE WHEN _status IN ('starting','uploading','rendering','processing','saving') THEN locked_until ELSE NULL END,
         last_heartbeat_at = now(),
         finished_at = CASE WHEN _status IN ('completed','failed','cancelled') THEN now() ELSE finished_at END,
         provider = COALESCE(_provider, provider),
         model = COALESCE(_model, model),
         output_url = COALESCE(_output_url, output_url),
         cover_url = COALESCE(_cover_url, cover_url),
         credits_charged = COALESCE(_credits_charged, credits_charged),
         latency_ms = COALESCE(_latency_ms, latency_ms),
         error = _error
   WHERE id = _clip_id
     AND (worker_id = _worker_id OR worker_id IS NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.release_clip_job(uuid, text, text, text, text, text, text, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_clip_job(uuid, text, text, text, text, text, text, integer, integer, text) TO service_role;

-- ============================================================
-- reclaim_stalled_clip_jobs: recover leases whose worker died
-- ============================================================
CREATE OR REPLACE FUNCTION public.reclaim_stalled_clip_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  WITH upd AS (
    UPDATE public.render_clip_jobs
       SET status = CASE
             WHEN attempts >= max_attempts THEN 'failed'
             ELSE 'retrying'
           END,
           error = COALESCE(error, 'lease expired'),
           worker_id = NULL,
           locked_until = NULL,
           last_heartbeat_at = now()
     WHERE status IN ('starting','uploading','rendering','processing','saving')
       AND locked_until IS NOT NULL
       AND locked_until < now() - interval '30 seconds'
     RETURNING 1
  )
  SELECT count(*) INTO _count FROM upd;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.reclaim_stalled_clip_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stalled_clip_jobs() TO service_role;

-- ============================================================
-- reset_failed_clips_for_repair: Repair Movie primitive
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_failed_clips_for_repair(_job_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  WITH upd AS (
    UPDATE public.render_clip_jobs
       SET status = 'queued',
           attempts = 0,
           worker_id = NULL,
           locked_until = NULL,
           error = NULL,
           finished_at = NULL,
           last_heartbeat_at = now()
     WHERE job_id = _job_id
       AND status = 'failed'
     RETURNING 1
  )
  SELECT count(*) INTO _count FROM upd;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_failed_clips_for_repair(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_failed_clips_for_repair(uuid) TO service_role;

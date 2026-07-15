
-- Idempotent billing reference: stable across retries so we never double-charge.
ALTER TABLE public.render_clip_jobs
  ADD COLUMN IF NOT EXISTS billing_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS render_clip_jobs_billing_ref_uidx
  ON public.render_clip_jobs (billing_ref) WHERE billing_ref IS NOT NULL;

-- Backfill deterministic billing_ref for existing rows.
UPDATE public.render_clip_jobs
   SET billing_ref = 'bgclip_' || id::text
 WHERE billing_ref IS NULL;

-- Composition + notification watermarks on render_jobs (all optional/additive).
ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS composition_state text
    CHECK (composition_state IN ('pending','composing','uploading','notifying','ready','failed')),
  ADD COLUMN IF NOT EXISTS movie_url text,
  ADD COLUMN IF NOT EXISTS movie_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_notified_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notifications_sent jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS composition_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS composition_error text;

-- Enhanced logging (metadata on render_clip_jobs already covers most).
COMMENT ON COLUMN public.render_jobs.notifications_sent IS
  'Map of notification kind => sent_at ISO timestamp. Used for idempotent notifications.';

-- has_charged_ref: returns true when a completed commit exists for the ref.
-- credit_transactions rows with status=completed and negative credits are
-- successful commits. Positive-credits completed rows are grants, not charges.
CREATE OR REPLACE FUNCTION public.has_charged_ref(_ref text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.credit_transactions
     WHERE ref_id = _ref
       AND status = 'completed'
       AND credits < 0
  );
$$;

REVOKE ALL ON FUNCTION public.has_charged_ref(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_charged_ref(text) TO service_role;

-- notify_user: idempotent notification insert (used by background worker).
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _kind text,
  _title text,
  _body text DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _dedupe_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _existing uuid; _id uuid;
BEGIN
  IF _dedupe_key IS NOT NULL THEN
    SELECT id INTO _existing
      FROM public.notifications
     WHERE user_id = _user_id
       AND kind = _kind
       AND (project_id IS NOT DISTINCT FROM _project_id)
       AND title = _title
     ORDER BY created_at DESC
     LIMIT 1;
    IF _existing IS NOT NULL THEN
      RETURN _existing;
    END IF;
  END IF;
  INSERT INTO public.notifications(user_id, kind, title, body, project_id)
  VALUES (_user_id, _kind, _title, _body, _project_id)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, uuid, text) TO service_role;

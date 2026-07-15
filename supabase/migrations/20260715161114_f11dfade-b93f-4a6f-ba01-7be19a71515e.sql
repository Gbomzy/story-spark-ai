
REVOKE ALL ON FUNCTION public.sync_render_job_from_project() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_render_job_from_project() TO service_role;

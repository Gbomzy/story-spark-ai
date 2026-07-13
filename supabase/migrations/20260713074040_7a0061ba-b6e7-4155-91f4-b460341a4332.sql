alter table public.projects add column if not exists orchestrator_state jsonb;
alter table public.profiles add column if not exists onboarding jsonb not null default '{"completed": false}'::jsonb;
create index if not exists idx_projects_orch_status on public.projects ((orchestrator_state->>'status'));
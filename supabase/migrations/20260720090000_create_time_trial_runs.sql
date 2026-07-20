create table public.time_trial_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_key date not null,
  sequence_version text not null,
  sequence_codes text[] not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, daily_key)
);

create index time_trial_runs_expiry_idx
  on public.time_trial_runs (expires_at)
  where submitted_at is null;

alter table public.time_trial_runs enable row level security;

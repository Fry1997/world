create table public.time_trial_challenges (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  daily_key date not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique (creator_user_id, daily_key)
);

create index time_trial_challenges_expiry_idx
  on public.time_trial_challenges (expires_at);

alter table public.time_trial_challenges enable row level security;
revoke all on public.time_trial_challenges from public, anon, authenticated;

create or replace function public.create_time_trial_challenge()
returns table (
  challenge_id uuid,
  challenge_day date,
  creator_name text,
  countries_found integer,
  guess_count integer,
  time_remaining_ms integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_challenge public.time_trial_challenges%rowtype;
  v_result public.game_results%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select gr.* into v_result
  from public.game_results gr
  where gr.user_id = v_user_id
    and gr.mode = 'time_trial'
    and gr.daily_key = current_date
    and coalesce((gr.payload ->> 'verified')::boolean, false)
  order by gr.completed_at desc
  limit 1;

  if not found then raise exception 'COMPLETE_RANKED_RUN_FIRST'; end if;

  insert into public.time_trial_challenges (creator_user_id, daily_key)
  values (v_user_id, current_date)
  on conflict (creator_user_id, daily_key)
  do update set expires_at = greatest(public.time_trial_challenges.expires_at, now() + interval '7 days')
  returning * into v_challenge;

  return query
  select
    v_challenge.id,
    v_challenge.daily_key,
    coalesce(nullif(p.display_name, ''), 'Explorer'),
    coalesce(v_result.score, 0),
    coalesce(v_result.guess_count, 0),
    coalesce((v_result.payload ->> 'timeRemainingMs')::integer, 0),
    v_challenge.expires_at
  from public.profiles p
  where p.id = v_user_id;
end;
$$;

create or replace function public.get_time_trial_challenge(p_challenge_id uuid)
returns table (
  challenge_id uuid,
  challenge_day date,
  creator_name text,
  creator_countries_found integer,
  creator_guess_count integer,
  creator_time_remaining_ms integer,
  expires_at timestamptz,
  viewer_countries_found integer,
  viewer_guess_count integer,
  viewer_time_remaining_ms integer,
  viewer_has_result boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    challenge.id,
    challenge.daily_key,
    coalesce(nullif(profile.display_name, ''), 'Explorer'),
    coalesce(creator_result.score, 0),
    coalesce(creator_result.guess_count, 0),
    coalesce((creator_result.payload ->> 'timeRemainingMs')::integer, 0),
    challenge.expires_at,
    viewer_result.score,
    viewer_result.guess_count,
    (viewer_result.payload ->> 'timeRemainingMs')::integer,
    viewer_result.id is not null
  from public.time_trial_challenges challenge
  join public.profiles profile on profile.id = challenge.creator_user_id
  join public.game_results creator_result
    on creator_result.user_id = challenge.creator_user_id
   and creator_result.mode = 'time_trial'
   and creator_result.daily_key = challenge.daily_key
   and coalesce((creator_result.payload ->> 'verified')::boolean, false)
  left join public.game_results viewer_result
    on viewer_result.user_id = auth.uid()
   and viewer_result.mode = 'time_trial'
   and viewer_result.daily_key = challenge.daily_key
   and coalesce((viewer_result.payload ->> 'verified')::boolean, false)
  where challenge.id = p_challenge_id
    and challenge.expires_at > now()
  limit 1;
$$;

grant execute on function public.create_time_trial_challenge() to authenticated;
grant execute on function public.get_time_trial_challenge(uuid) to anon, authenticated;

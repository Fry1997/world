create or replace function public.start_time_trial_run(
  p_daily_key date,
  p_sequence_version text,
  p_sequence_codes text[]
)
returns table (
  run_id uuid,
  daily_key date,
  sequence_version text,
  started_at timestamptz,
  ends_at timestamptz,
  resumed boolean
)
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.time_trial_runs%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_daily_key <> current_date then raise exception 'INVALID_DAILY_KEY'; end if;
  if array_length(p_sequence_codes, 1) <> 197 then raise exception 'INVALID_SEQUENCE'; end if;
  if exists (
    select 1 from public.game_results gr
    where gr.user_id = v_user_id and gr.mode = 'time_trial' and gr.daily_key = p_daily_key
  ) then raise exception 'ALREADY_COMPLETED'; end if;

  select ttr.* into v_run
  from public.time_trial_runs ttr
  where ttr.user_id = v_user_id and ttr.daily_key = p_daily_key;

  if found then
    if v_run.submitted_at is not null then raise exception 'ALREADY_COMPLETED'; end if;
    if now() > v_run.expires_at + interval '15 seconds' then raise exception 'ATTEMPT_EXPIRED'; end if;
    return query select v_run.id, v_run.daily_key, v_run.sequence_version, v_run.started_at, v_run.expires_at, true;
    return;
  end if;

  insert into public.time_trial_runs (
    user_id, daily_key, sequence_version, sequence_codes, started_at, expires_at
  ) values (
    v_user_id, p_daily_key, p_sequence_version, p_sequence_codes, now(), now() + interval '3 minutes'
  ) returning * into v_run;

  return query select v_run.id, v_run.daily_key, v_run.sequence_version, v_run.started_at, v_run.expires_at, false;
end;
$$;

grant execute on function public.start_time_trial_run(date, text, text[]) to authenticated;

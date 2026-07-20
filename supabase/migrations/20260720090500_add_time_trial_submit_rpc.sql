create or replace function public.submit_time_trial_run(
  p_run_id uuid,
  p_client_run_id text,
  p_found integer,
  p_guesses integer,
  p_solved jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_run public.time_trial_runs%rowtype;
  v_index integer;
  v_item jsonb;
  v_code text;
  v_count integer;
  v_solved_guesses integer := 0;
  v_completed_at timestamptz := now();
  v_duration_ms integer;
  v_time_remaining_ms integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_client_run_id is null or char_length(p_client_run_id) > 128 then raise exception 'INVALID_RESULT_ID'; end if;
  if p_found < 0 or p_found > 197 or jsonb_typeof(p_solved) <> 'array' or jsonb_array_length(p_solved) <> p_found then
    raise exception 'INVALID_FOUND_COUNT';
  end if;
  if p_guesses < 0 or p_guesses > 1000 then raise exception 'INVALID_GUESS_COUNT'; end if;

  select ttr.* into v_run
  from public.time_trial_runs ttr
  where ttr.id = p_run_id and ttr.user_id = v_user_id
  for update;

  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  if v_run.submitted_at is not null then raise exception 'ALREADY_SUBMITTED'; end if;
  if now() > v_run.expires_at + interval '15 seconds' then raise exception 'SUBMISSION_CLOSED'; end if;

  if p_found > 0 then
    for v_index in 0..p_found - 1 loop
      v_item := p_solved -> v_index;
      v_code := v_item ->> 'code';
      v_count := (v_item ->> 'guesses')::integer;
      if v_code is distinct from v_run.sequence_codes[v_index + 1] or v_count < 1 or v_count > 200 then
        raise exception 'INVALID_SEQUENCE';
      end if;
      v_solved_guesses := v_solved_guesses + v_count;
    end loop;
  end if;

  if p_guesses < v_solved_guesses then raise exception 'INVALID_GUESS_TOTAL'; end if;

  v_duration_ms := least(180000, greatest(0, floor(extract(epoch from (v_completed_at - v_run.started_at)) * 1000)::integer));
  v_time_remaining_ms := greatest(0, 180000 - v_duration_ms);

  insert into public.game_results (
    user_id, client_run_id, mode, daily_key, solved, guess_count,
    duration_ms, score, payload, completed_at
  ) values (
    v_user_id, p_client_run_id, 'time_trial', v_run.daily_key, p_found > 0,
    p_guesses, v_duration_ms, p_found,
    jsonb_build_object(
      'verified', true,
      'sequenceVersion', v_run.sequence_version,
      'timeRemainingMs', v_time_remaining_ms,
      'solved', p_solved
    ),
    v_completed_at
  );

  update public.time_trial_runs
  set submitted_at = v_completed_at
  where id = v_run.id;

  return jsonb_build_object(
    'verified', true,
    'dateKey', v_run.daily_key,
    'countriesFound', p_found,
    'guessCount', p_guesses,
    'durationMs', v_duration_ms,
    'timeRemainingMs', v_time_remaining_ms
  );
end;
$$;

grant execute on function public.submit_time_trial_run(uuid, text, integer, integer, jsonb) to authenticated;

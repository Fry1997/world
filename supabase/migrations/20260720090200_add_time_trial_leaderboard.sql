create or replace function public.get_time_trial_leaderboard(
  p_daily_key date default current_date,
  p_limit integer default 100
)
returns table (
  rank_position bigint,
  display_name text,
  countries_found integer,
  guess_count integer,
  time_remaining_ms integer,
  completed_at timestamptz,
  is_current_user boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      row_number() over (
        order by
          gr.score desc,
          gr.guess_count asc nulls last,
          coalesce((gr.payload ->> 'timeRemainingMs')::integer, 0) desc,
          gr.completed_at asc
      ) as rank_position,
      coalesce(nullif(p.display_name, ''), 'Explorer') as display_name,
      coalesce(gr.score, 0) as countries_found,
      coalesce(gr.guess_count, 0) as guess_count,
      coalesce((gr.payload ->> 'timeRemainingMs')::integer, 0) as time_remaining_ms,
      gr.completed_at,
      gr.user_id = auth.uid() as is_current_user
    from public.game_results gr
    join public.profiles p on p.id = gr.user_id
    where gr.mode = 'time_trial'
      and gr.daily_key = p_daily_key
      and coalesce((gr.payload ->> 'verified')::boolean, false)
  )
  select * from ranked
  order by rank_position
  limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.get_time_trial_leaderboard(date, integer) to anon, authenticated;

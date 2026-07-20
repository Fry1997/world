create unique index game_results_one_ranked_time_trial_per_day
  on public.game_results (user_id, daily_key)
  where mode = 'time_trial' and daily_key is not null;

drop policy if exists "game_results_insert_own" on public.game_results;
drop policy if exists "game_results_update_own" on public.game_results;
drop policy if exists "game_results_delete_own" on public.game_results;

create policy "game_results_insert_noncompetitive" on public.game_results
  for insert with check (auth.uid() = user_id and mode <> 'time_trial');

create policy "game_results_update_noncompetitive" on public.game_results
  for update using (auth.uid() = user_id and mode <> 'time_trial')
  with check (auth.uid() = user_id and mode <> 'time_trial');

create policy "game_results_delete_noncompetitive" on public.game_results
  for delete using (auth.uid() = user_id and mode <> 'time_trial');

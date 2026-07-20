create policy "time_trial_runs_no_direct_access" on public.time_trial_runs
  for all to anon, authenticated
  using (false) with check (false);

create policy "time_trial_challenges_no_direct_access" on public.time_trial_challenges
  for all to anon, authenticated
  using (false) with check (false);

revoke all on function public.start_time_trial_run(date, text, text[]) from public, anon, authenticated;
grant execute on function public.start_time_trial_run(date, text, text[]) to authenticated;

revoke all on function public.submit_time_trial_run(uuid, text, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.submit_time_trial_run(uuid, text, integer, integer, jsonb) to authenticated;

revoke all on function public.create_time_trial_challenge() from public, anon, authenticated;
grant execute on function public.create_time_trial_challenge() to authenticated;

revoke all on function public.get_time_trial_leaderboard(date, integer) from public, anon, authenticated;
grant execute on function public.get_time_trial_leaderboard(date, integer) to anon, authenticated;

revoke all on function public.get_time_trial_challenge(uuid) from public, anon, authenticated;
grant execute on function public.get_time_trial_challenge(uuid) to anon, authenticated;

drop policy if exists "game_results_insert_noncompetitive" on public.game_results;
drop policy if exists "game_results_update_noncompetitive" on public.game_results;
drop policy if exists "game_results_delete_noncompetitive" on public.game_results;

create policy "game_results_insert_noncompetitive" on public.game_results
  for insert with check ((select auth.uid()) = user_id and mode <> 'time_trial');

create policy "game_results_update_noncompetitive" on public.game_results
  for update using ((select auth.uid()) = user_id and mode <> 'time_trial')
  with check ((select auth.uid()) = user_id and mode <> 'time_trial');

create policy "game_results_delete_noncompetitive" on public.game_results
  for delete using ((select auth.uid()) = user_id and mode <> 'time_trial');

create index if not exists user_achievements_achievement_key_idx on public.user_achievements (achievement_key);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert with check ((select auth.uid()) = id);

drop policy if exists "user_state_select_own" on public.user_state;
drop policy if exists "user_state_insert_own" on public.user_state;
drop policy if exists "user_state_update_own" on public.user_state;
drop policy if exists "user_state_delete_own" on public.user_state;
create policy "user_state_select_own" on public.user_state for select using ((select auth.uid()) = user_id);
create policy "user_state_insert_own" on public.user_state for insert with check ((select auth.uid()) = user_id);
create policy "user_state_update_own" on public.user_state for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_state_delete_own" on public.user_state for delete using ((select auth.uid()) = user_id);

drop policy if exists "user_achievements_select_own" on public.user_achievements;
drop policy if exists "user_achievements_insert_own" on public.user_achievements;
drop policy if exists "user_achievements_update_own" on public.user_achievements;
create policy "user_achievements_select_own" on public.user_achievements for select using ((select auth.uid()) = user_id);
create policy "user_achievements_insert_own" on public.user_achievements for insert with check ((select auth.uid()) = user_id);
create policy "user_achievements_update_own" on public.user_achievements for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "game_results_select_own" on public.game_results;
drop policy if exists "game_results_insert_own" on public.game_results;
drop policy if exists "game_results_update_own" on public.game_results;
drop policy if exists "game_results_delete_own" on public.game_results;
create policy "game_results_select_own" on public.game_results for select using ((select auth.uid()) = user_id);
create policy "game_results_insert_own" on public.game_results for insert with check ((select auth.uid()) = user_id);
create policy "game_results_update_own" on public.game_results for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "game_results_delete_own" on public.game_results for delete using ((select auth.uid()) = user_id);

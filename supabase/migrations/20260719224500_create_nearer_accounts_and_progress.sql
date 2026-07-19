create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 32),
  avatar_seed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  namespace text not null check (namespace in ('solo', 'mastery', 'mastery_session', 'preferences')),
  payload jsonb not null default '{}'::jsonb,
  client_updated_at timestamptz not null default now(),
  device_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, namespace)
);

create table public.achievement_definitions (
  key text primary key,
  name text not null,
  description text not null,
  icon text not null default '◆',
  category text not null default 'general',
  threshold numeric not null default 1,
  sort_order integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.achievement_definitions(key) on delete cascade,
  progress numeric not null default 0,
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_run_id text not null,
  mode text not null check (mode in ('daily', 'random', 'time_trial', 'mastery_practice', 'mastery_test', 'race', 'cooperative', 'duel')),
  target_code text,
  daily_key date,
  solved boolean not null default false,
  guess_count integer check (guess_count is null or guess_count >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  score integer,
  payload jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_run_id)
);

create index game_results_user_created_idx on public.game_results (user_id, created_at desc);
create index game_results_daily_idx on public.game_results (mode, daily_key, score desc) where daily_key is not null;
create index user_achievements_user_unlocked_idx on public.user_achievements (user_id, unlocked_at desc nulls last);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger user_state_set_updated_at before update on public.user_state
for each row execute function public.set_updated_at();
create trigger user_achievements_set_updated_at before update on public.user_achievements
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_seed)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Explorer'), '@', 1)),
    encode(digest(new.id::text, 'sha256'), 'hex')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.user_achievements enable row level security;
alter table public.game_results enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "user_state_select_own" on public.user_state for select using (auth.uid() = user_id);
create policy "user_state_insert_own" on public.user_state for insert with check (auth.uid() = user_id);
create policy "user_state_update_own" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_state_delete_own" on public.user_state for delete using (auth.uid() = user_id);

create policy "achievement_definitions_read" on public.achievement_definitions for select using (true);

create policy "user_achievements_select_own" on public.user_achievements for select using (auth.uid() = user_id);
create policy "user_achievements_insert_own" on public.user_achievements for insert with check (auth.uid() = user_id);
create policy "user_achievements_update_own" on public.user_achievements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "game_results_select_own" on public.game_results for select using (auth.uid() = user_id);
create policy "game_results_insert_own" on public.game_results for insert with check (auth.uid() = user_id);
create policy "game_results_update_own" on public.game_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "game_results_delete_own" on public.game_results for delete using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.achievement_definitions to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_state to authenticated;
grant select, insert, update on public.user_achievements to authenticated;
grant select, insert, update, delete on public.game_results to authenticated;

insert into public.achievement_definitions (key, name, description, icon, category, threshold, sort_order) values
('first_find', 'First Contact', 'Find your first hidden country.', '◎', 'play', 1, 10),
('five_games', 'Getting Your Bearings', 'Complete five Nearer games.', '◇', 'play', 5, 20),
('twenty_five_games', 'Seasoned Navigator', 'Complete twenty-five Nearer games.', '✦', 'play', 25, 30),
('hundred_games', 'World Traveller', 'Complete one hundred Nearer games.', '✧', 'play', 100, 40),
('ten_wins', 'Reliable Compass', 'Find ten hidden countries.', '⌖', 'play', 10, 50),
('daily_streak_3', 'Three-Day Signal', 'Win the Daily Challenge three days in a row.', '◉', 'daily', 3, 60),
('daily_streak_7', 'Week on the Map', 'Win the Daily Challenge seven days in a row.', '◈', 'daily', 7, 70),
('mastery_started', 'Student of the World', 'Study your first country in Regional Mastery.', '◆', 'mastery', 1, 80),
('mastery_first', 'Location Locked', 'Raise one country to mastered strength.', '⬡', 'mastery', 1, 90),
('mastery_ten', 'Regional Recall', 'Master ten countries.', '⬢', 'mastery', 10, 100),
('mastery_fifty', 'Map Memory', 'Master fifty countries.', '✺', 'mastery', 50, 110),
('all_regions_started', 'Six Corners of the World', 'Begin learning in every Regional Mastery path.', '✹', 'mastery', 6, 120)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  category = excluded.category,
  threshold = excluded.threshold,
  sort_order = excluded.sort_order;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_seed)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'Explorer'), '@', 1)
    ),
    encode(extensions.digest(new.id::text, 'sha256'), 'hex')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

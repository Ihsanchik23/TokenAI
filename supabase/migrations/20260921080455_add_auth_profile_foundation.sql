create or replace function public.ensure_my_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.profiles (id, username, role, is_public)
  values (
    current_user_id,
    'user_' || replace(current_user_id::text, '-', ''),
    'student',
    true
  )
  on conflict (id) do nothing;

  select *
  into current_profile
  from public.profiles
  where id = current_user_id;

  return current_profile;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

create or replace function public.update_my_profile(
  new_username text,
  new_display_name text,
  new_bio text,
  new_is_public boolean,
  selected_topic_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_username text := lower(btrim(new_username));
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_username !~ '^[a-z0-9_]{3,48}$' then
    raise exception 'Invalid username' using errcode = '22023';
  end if;

  if length(btrim(new_display_name)) < 2 or length(btrim(new_display_name)) > 80 then
    raise exception 'Invalid display name' using errcode = '22023';
  end if;

  if length(coalesce(new_bio, '')) > 500 then
    raise exception 'Bio is too long' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(selected_topic_ids, '{}'::uuid[])) as selected(id)
    left join public.topics on topics.id = selected.id
    where topics.id is null
  ) then
    raise exception 'Unknown topic' using errcode = '22023';
  end if;

  update public.profiles
  set
    username = normalized_username,
    display_name = btrim(new_display_name),
    bio = nullif(btrim(coalesce(new_bio, '')), ''),
    is_public = new_is_public
  where id = current_user_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  delete from public.profile_topics
  where profile_id = current_user_id;

  insert into public.profile_topics (profile_id, topic_id)
  select current_user_id, selected.id
  from (
    select distinct unnest(coalesce(selected_topic_ids, '{}'::uuid[])) as id
  ) as selected;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, boolean, uuid[]) from public;
grant execute on function public.update_my_profile(text, text, text, boolean, uuid[]) to authenticated;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and (select auth.uid()) is not null
    and coalesce(current_setting('tokenai.role_change_authorized', true), '') <> 'true'
  then
    raise exception 'Profile roles can only be changed through the authorized role service'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.set_user_role(target_user_id uuid, new_role public.profile_role)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_current_role public.profile_role;
begin
  if caller_id is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = caller_id then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if new_role not in ('student'::public.profile_role, 'instructor'::public.profile_role) then
    raise exception 'Only student and instructor roles are allowed' using errcode = '22023';
  end if;

  select role into target_current_role
  from public.profiles
  where id = target_user_id
  for update;

  if target_current_role is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if target_current_role = 'admin'::public.profile_role then
    raise exception 'Administrator roles cannot be changed here' using errcode = '42501';
  end if;

  perform set_config('tokenai.role_change_authorized', 'true', true);
  update public.profiles
  set role = new_role,
      role_changed_by = caller_id,
      role_changed_at = now()
  where id = target_user_id;

  return jsonb_build_object('id', target_user_id, 'role', new_role);
end;
$$;

revoke all on function public.set_user_role(uuid, public.profile_role) from public;
grant execute on function public.set_user_role(uuid, public.profile_role) to authenticated;

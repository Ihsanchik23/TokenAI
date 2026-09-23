alter table public.profiles
  add column if not exists role_changed_by uuid references auth.users (id) on delete set null,
  add column if not exists role_changed_at timestamptz;

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

create or replace function public.list_studio_users(
  search_text text default '',
  role_filter public.profile_role default null,
  page_number integer default 1,
  page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := trim(coalesce(search_text, ''));
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 25), 1), 50);
  total_rows bigint;
  users_payload jsonb;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select count(*) into total_rows
  from public.profiles profile
  join auth.users account on account.id = profile.id
  where (role_filter is null or profile.role = role_filter)
    and (
      normalized_search = ''
      or coalesce(profile.display_name, '') ilike '%' || normalized_search || '%'
      or profile.username::text ilike '%' || normalized_search || '%'
      or coalesce(account.email, '') ilike '%' || normalized_search || '%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', rows.id,
    'displayName', rows.display_name,
    'username', rows.username,
    'email', rows.email,
    'avatarPath', rows.avatar_path,
    'role', rows.role
  ) order by rows.sort_name, rows.username), '[]'::jsonb)
  into users_payload
  from (
    select profile.id, profile.display_name, profile.username::text as username,
      account.email, profile.avatar_path, profile.role,
      lower(coalesce(profile.display_name, profile.username::text)) as sort_name
    from public.profiles profile
    join auth.users account on account.id = profile.id
    where (role_filter is null or profile.role = role_filter)
      and (
        normalized_search = ''
        or coalesce(profile.display_name, '') ilike '%' || normalized_search || '%'
        or profile.username::text ilike '%' || normalized_search || '%'
        or coalesce(account.email, '') ilike '%' || normalized_search || '%'
      )
    order by sort_name, profile.username
    limit safe_size offset (safe_page - 1) * safe_size
  ) rows;

  return jsonb_build_object(
    'users', users_payload,
    'total', total_rows,
    'page', safe_page,
    'pageSize', safe_size
  );
end;
$$;

revoke all on function public.list_studio_users(text, public.profile_role, integer, integer) from public;
grant execute on function public.list_studio_users(text, public.profile_role, integer, integer) to authenticated;

drop policy "Public profiles are readable" on public.profiles;
create policy "Scoped profiles are readable"
on public.profiles for select
using (
  is_public
  or id = (select auth.uid())
  or public.is_admin()
  or (
    public.is_staff()
    and (
      role in ('admin', 'instructor')
      or exists (
        select 1
        from public.enrollments enrollment
        where enrollment.user_id = profiles.id
          and public.is_course_staff(enrollment.course_id)
      )
    )
  )
);

drop policy "Staff manage topics" on public.topics;
create policy "Admins manage topics"
on public.topics for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy "Published or enrolled courses are readable" on public.courses;
create policy "Published enrolled or assigned courses are readable"
on public.courses for select
using (
  status = 'published'
  or public.is_course_staff(id)
  or public.is_enrolled_in_course(id)
);

drop policy "Users read own quiz attempts" on public.quiz_attempts;
create policy "Owners and course staff read quiz attempts"
on public.quiz_attempts for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    join public.modules module on module.id = lesson.module_id
    where quiz.id = quiz_attempts.quiz_id
      and public.is_course_staff(module.course_id)
  )
);

drop policy "Staff update quiz attempts" on public.quiz_attempts;
create policy "Course staff update quiz attempts"
on public.quiz_attempts for update to authenticated
using (
  exists (
    select 1 from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    join public.modules module on module.id = lesson.module_id
    where quiz.id = quiz_attempts.quiz_id
      and public.is_course_staff(module.course_id)
  )
)
with check (
  exists (
    select 1 from public.quizzes quiz
    join public.lessons lesson on lesson.id = quiz.lesson_id
    join public.modules module on module.id = lesson.module_id
    where quiz.id = quiz_attempts.quiz_id
      and public.is_course_staff(module.course_id)
  )
);

drop policy "Staff manage quiz attempt answers" on public.quiz_attempt_answers;
create policy "Course staff manage quiz attempt answers"
on public.quiz_attempt_answers for all to authenticated
using (
  exists (
    select 1 from public.quiz_attempts attempt
    join public.quizzes quiz on quiz.id = attempt.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    join public.modules module on module.id = lesson.module_id
    where attempt.id = quiz_attempt_answers.attempt_id
      and public.is_course_staff(module.course_id)
  )
)
with check (
  exists (
    select 1 from public.quiz_attempts attempt
    join public.quizzes quiz on quiz.id = attempt.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    join public.modules module on module.id = lesson.module_id
    where attempt.id = quiz_attempt_answers.attempt_id
      and public.is_course_staff(module.course_id)
  )
);

drop policy "Users read own enrollments" on public.enrollments;
create policy "Owners and course staff read enrollments"
on public.enrollments for select to authenticated
using (user_id = (select auth.uid()) or public.is_course_staff(course_id));

drop policy "Users read own lesson progress" on public.lesson_progress;
drop policy "Staff manage lesson progress" on public.lesson_progress;
create policy "Owners and course staff read lesson progress"
on public.lesson_progress for select to authenticated
using (
  exists (
    select 1 from public.enrollments enrollment
    where enrollment.id = lesson_progress.enrollment_id
      and (enrollment.user_id = (select auth.uid()) or public.is_course_staff(enrollment.course_id))
  )
);
create policy "Course staff manage lesson progress"
on public.lesson_progress for all to authenticated
using (
  exists (
    select 1 from public.enrollments enrollment
    where enrollment.id = lesson_progress.enrollment_id
      and public.is_course_staff(enrollment.course_id)
  )
)
with check (
  exists (
    select 1 from public.enrollments enrollment
    where enrollment.id = lesson_progress.enrollment_id
      and public.is_course_staff(enrollment.course_id)
  )
);

drop policy "Users read own orders" on public.orders;
drop policy "Staff manage orders" on public.orders;
create policy "Owners and admins read orders"
on public.orders for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());
create policy "Admins manage orders"
on public.orders for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy "Users read own payments" on public.payments;
drop policy "Staff manage payments" on public.payments;
create policy "Owners and admins read payments"
on public.payments for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders account_order
    where account_order.id = payments.order_id
      and account_order.user_id = (select auth.uid())
  )
);
create policy "Admins manage payments"
on public.payments for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy "Published course reviews are readable" on public.course_reviews;
create policy "Published or assigned course reviews are readable"
on public.course_reviews for select
using (
  public.is_course_staff(course_id)
  or exists (
    select 1 from public.courses course
    where course.id = course_reviews.course_id
      and course.status = 'published'
  )
);

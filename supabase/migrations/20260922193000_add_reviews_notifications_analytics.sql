alter table public.course_reviews
  add constraint course_reviews_text_length check (text is null or length(text) <= 2000);

drop policy if exists "Enrolled users create own reviews" on public.course_reviews;
drop policy if exists "Users update own reviews" on public.course_reviews;
drop policy if exists "Users delete own reviews" on public.course_reviews;

drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Staff manage notifications" on public.notifications;

create policy "Users read own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.course_review_eligibility(
  target_course_id uuid,
  target_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_enrollment as (
    select enrollment.id, enrollment.status, enrollment.expires_at
    from public.enrollments enrollment
    where enrollment.course_id = target_course_id
      and enrollment.user_id = target_user_id
    limit 1
  ),
  totals as (
    select
      count(*) filter (where lesson.is_required)::integer as required_count,
      count(*) filter (
        where lesson.is_required and progress.status = 'completed'
      )::integer as completed_count
    from public.modules module
    join public.lessons lesson on lesson.module_id = module.id
    left join selected_enrollment enrollment on true
    left join public.lesson_progress progress
      on progress.enrollment_id = enrollment.id
      and progress.lesson_id = lesson.id
    where module.course_id = target_course_id
  )
  select jsonb_build_object(
    'enrolled', enrollment.id is not null,
    'eligible', coalesce(
      enrollment.status = 'completed'
      or (
        enrollment.status = 'active'
        and (enrollment.expires_at is null or enrollment.expires_at > now())
        and totals.required_count > 0
        and totals.completed_count * 100.0 / totals.required_count >= 50
      ),
      false
    ),
    'progressPercentage', case
      when enrollment.status = 'completed' then 100
      when totals.required_count = 0 then 0
      else round(totals.completed_count * 100.0 / totals.required_count, 2)
    end
  )
  from totals
  left join selected_enrollment enrollment on true;
$$;

create or replace function public.get_my_course_review_state(target_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  result := public.course_review_eligibility(target_course_id, current_user_id);

  return result || jsonb_build_object(
    'review', (
      select jsonb_build_object(
        'id', review.id,
        'rating', review.rating,
        'text', review.text,
        'createdAt', review.created_at,
        'updatedAt', review.updated_at
      )
      from public.course_reviews review
      where review.course_id = target_course_id
        and review.user_id = current_user_id
    )
  );
end;
$$;

create or replace function public.save_course_review(
  target_course_id uuid,
  target_rating integer,
  review_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  eligibility jsonb;
  normalized_text text := nullif(btrim(coalesce(review_text, '')), '');
  saved_review public.course_reviews;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if target_rating not between 1 and 5
    or (normalized_text is not null and length(normalized_text) > 2000)
  then
    raise exception 'Review fields are invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_course_id::text || current_user_id::text, 0));
  eligibility := public.course_review_eligibility(target_course_id, current_user_id);
  if not coalesce((eligibility ->> 'eligible')::boolean, false) then
    raise exception 'Review eligibility required' using errcode = '42501';
  end if;

  insert into public.course_reviews (course_id, user_id, rating, text)
  values (target_course_id, current_user_id, target_rating, normalized_text)
  on conflict (user_id, course_id) do update
  set rating = excluded.rating, text = excluded.text, updated_at = now()
  returning * into saved_review;

  return jsonb_build_object(
    'id', saved_review.id,
    'rating', saved_review.rating,
    'text', saved_review.text
  );
end;
$$;

create or replace function public.delete_course_review(target_course_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  deleted_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.course_reviews
  where course_id = target_course_id and user_id = current_user_id;
  get diagnostics deleted_count = row_count;
  return deleted_count = 1;
end;
$$;

create or replace function public.get_public_course_reviews(
  target_course_id uuid,
  result_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.courses course
    where course.id = target_course_id and course.status = 'published'
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'averageRating', round(avg(review.rating)::numeric, 2),
    'reviewCount', count(*)::integer,
    'reviews', coalesce((
      select jsonb_agg(item order by (item ->> 'createdAt') desc)
      from (
        select jsonb_build_object(
          'id', listed.id,
          'rating', listed.rating,
          'text', listed.text,
          'createdAt', listed.created_at,
          'displayName', case when profile.is_public then profile.display_name else null end,
          'username', case when profile.is_public then profile.username::text else null end,
          'avatarPath', case when profile.is_public then profile.avatar_path else null end
        ) as item
        from public.course_reviews listed
        left join public.profiles profile on profile.id = listed.user_id
        where listed.course_id = target_course_id
        order by listed.created_at desc
        limit least(greatest(coalesce(result_limit, 30), 1), 100)
      ) rows
    ), '[]'::jsonb)
  ) into result
  from public.course_reviews review
  where review.course_id = target_course_id;

  return result;
end;
$$;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  changed_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.notifications set is_read = true
  where id = target_notification_id and user_id = current_user_id;
  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  changed_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.notifications set is_read = true
  where user_id = current_user_id and not is_read;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function public.get_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null then 0 else count(*)::integer end
  from public.notifications notification
  where notification.user_id = (select auth.uid()) and not notification.is_read;
$$;

create or replace function public.get_staff_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_role public.profile_role;
  platform_metrics jsonb;
  course_metrics jsonb;
begin
  select profile.role into current_role
  from public.profiles profile where profile.id = current_user_id;

  if current_role not in ('admin', 'instructor') then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if current_role = 'admin' then
    select jsonb_build_object(
      'totalUsers', (select count(*)::integer from public.profiles),
      'publicProfiles', (select count(*)::integer from public.profiles where is_public),
      'privateProfiles', (select count(*)::integer from public.profiles where not is_public),
      'publishedCourses', (select count(*)::integer from public.courses where status = 'published'),
      'totalEnrollments', (select count(*)::integer from public.enrollments),
      'activeEnrollments', (select count(*)::integer from public.enrollments where status = 'active'),
      'completedEnrollments', (select count(*)::integer from public.enrollments where status = 'completed'),
      'certificatesIssued', (select count(*)::integer from public.certificates),
      'publishedShowcaseWorks', (select count(*)::integer from public.showcase_works where status = 'published')
    ) into platform_metrics;
  end if;

  with visible_courses as (
    select course.*
    from public.courses course
    where current_role = 'admin'
      or exists (
        select 1 from public.course_instructors instructor
        where instructor.course_id = course.id and instructor.user_id = current_user_id
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', course.id,
    'slug', course.slug,
    'title', course.title,
    'status', course.status,
    'enrollments', stats.enrollments,
    'activeEnrollments', stats.active_enrollments,
    'startedStudents', stats.started_students,
    'completedStudents', stats.completed_students,
    'completionRate', stats.completion_rate,
    'averageProgress', stats.average_progress,
    'averageQuizPercentage', quiz.average_percentage,
    'assignmentSubmittedCount', assignment.submitted_count,
    'assignmentApprovedCount', assignment.approved_count,
    'averageRating', rating.average_rating,
    'reviewCount', rating.review_count,
    'modules', modules.items
  ) order by course.created_at desc), '[]'::jsonb)
  into course_metrics
  from visible_courses course
  cross join lateral (
    select
      count(*)::integer as enrollments,
      count(*) filter (where enrollment.status = 'active')::integer as active_enrollments,
      count(*) filter (where enrollment.started_at is not null)::integer as started_students,
      count(*) filter (where enrollment.status = 'completed')::integer as completed_students,
      coalesce(round(
        count(*) filter (where enrollment.status = 'completed') * 100.0 / nullif(count(*), 0), 2
      ), 0) as completion_rate,
      coalesce(round(avg(case
        when enrollment.status = 'completed' then 100
        when progress.required_count = 0 then 0
        else progress.completed_count * 100.0 / progress.required_count
      end), 2), 0) as average_progress
    from public.enrollments enrollment
    cross join lateral (
      select
        count(*) filter (where lesson.is_required)::integer as required_count,
        count(*) filter (
          where lesson.is_required and lesson_progress.status = 'completed'
        )::integer as completed_count
      from public.modules module
      join public.lessons lesson on lesson.module_id = module.id
      left join public.lesson_progress lesson_progress
        on lesson_progress.enrollment_id = enrollment.id
        and lesson_progress.lesson_id = lesson.id
      where module.course_id = course.id
    ) progress
    where enrollment.course_id = course.id
  ) stats
  cross join lateral (
    select round(avg(attempt.percentage), 2) as average_percentage
    from public.quiz_attempts attempt
    join public.quizzes quiz on quiz.id = attempt.quiz_id
    join public.lessons lesson on lesson.id = quiz.lesson_id
    join public.modules module on module.id = lesson.module_id
    where module.course_id = course.id and attempt.completed_at is not null
  ) quiz
  cross join lateral (
    select
      count(*)::integer as submitted_count,
      count(*) filter (where submission.status = 'approved')::integer as approved_count
    from public.assignment_submissions submission
    join public.assignments assignment_row on assignment_row.id = submission.assignment_id
    join public.lessons lesson on lesson.id = assignment_row.lesson_id
    join public.modules module on module.id = lesson.module_id
    where module.course_id = course.id
  ) assignment
  cross join lateral (
    select round(avg(review.rating)::numeric, 2) as average_rating, count(*)::integer as review_count
    from public.course_reviews review where review.course_id = course.id
  ) rating
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', module.id,
      'title', module.title,
      'position', module.position,
      'reachedStudents', module_stats.reached_students,
      'completedStudents', module_stats.completed_students
    ) order by module.position), '[]'::jsonb) as items
    from public.modules module
    cross join lateral (
      select
        count(*) filter (where progress.reached)::integer as reached_students,
        count(*) filter (
          where progress.reached
            and progress.required_count > 0
            and progress.completed_count = progress.required_count
        )::integer as completed_students
      from public.enrollments enrollment
      cross join lateral (
        select
          exists (
            select 1 from public.lesson_progress lesson_progress
            join public.lessons lesson on lesson.id = lesson_progress.lesson_id
            where lesson_progress.enrollment_id = enrollment.id
              and lesson.module_id = module.id
              and lesson_progress.status in ('in_progress', 'completed')
          ) as reached,
          count(*) filter (where lesson.is_required)::integer as required_count,
          count(*) filter (
            where lesson.is_required and lesson_progress.status = 'completed'
          )::integer as completed_count
        from public.lessons lesson
        left join public.lesson_progress lesson_progress
          on lesson_progress.enrollment_id = enrollment.id
          and lesson_progress.lesson_id = lesson.id
        where lesson.module_id = module.id
      ) progress
      where enrollment.course_id = course.id
    ) module_stats
    where module.course_id = course.id
  ) modules;

  return jsonb_build_object('platform', platform_metrics, 'courses', course_metrics);
end;
$$;

revoke all on function public.course_review_eligibility(uuid, uuid) from public;
revoke all on function public.get_my_course_review_state(uuid) from public;
revoke all on function public.save_course_review(uuid, integer, text) from public;
revoke all on function public.delete_course_review(uuid) from public;
revoke all on function public.get_public_course_reviews(uuid, integer) from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.get_unread_notification_count() from public;
revoke all on function public.get_staff_analytics() from public;

grant execute on function public.get_my_course_review_state(uuid) to authenticated;
grant execute on function public.save_course_review(uuid, integer, text) to authenticated;
grant execute on function public.delete_course_review(uuid) to authenticated;
grant execute on function public.get_public_course_reviews(uuid, integer) to anon, authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;
grant execute on function public.get_staff_analytics() to authenticated;

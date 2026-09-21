drop policy "Users update own lesson progress" on public.lesson_progress;

create or replace function public.is_lesson_available_for_enrollment(
  target_enrollment_id uuid,
  target_lesson_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.modules target_module on target_module.course_id = e.course_id
    join public.lessons target_lesson
      on target_lesson.module_id = target_module.id
      and target_lesson.id = target_lesson_id
    where e.id = target_enrollment_id
      and e.user_id = (select auth.uid())
      and e.status in ('active', 'completed')
      and (e.expires_at is null or e.expires_at > now())
      and (
        exists (
          select 1 from public.lesson_progress current_progress
          where current_progress.enrollment_id = e.id
            and current_progress.lesson_id = target_lesson.id
            and current_progress.status = 'completed'
        )
        or not exists (
          select 1
          from public.modules previous_module
          join public.lessons previous_lesson on previous_lesson.module_id = previous_module.id
          where previous_module.course_id = e.course_id
            and previous_lesson.is_required
            and (
              previous_module.position < target_module.position
              or (
                previous_module.position = target_module.position
                and previous_lesson.position < target_lesson.position
              )
            )
            and not exists (
              select 1 from public.lesson_progress previous_progress
              where previous_progress.enrollment_id = e.id
                and previous_progress.lesson_id = previous_lesson.id
                and previous_progress.status = 'completed'
            )
        )
      )
  );
$$;

create or replace function public.start_lesson(target_lesson_id uuid)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_enrollment public.enrollments;
  saved_progress public.lesson_progress;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select e.* into target_enrollment
  from public.enrollments e
  join public.modules m on m.course_id = e.course_id
  join public.lessons l on l.module_id = m.id
  where e.user_id = current_user_id
    and l.id = target_lesson_id
    and e.status in ('active', 'completed')
    and (e.expires_at is null or e.expires_at > now())
  for update of e;

  if target_enrollment.id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment.id, target_lesson_id)
  then
    raise exception 'Lesson is locked or enrollment is inactive' using errcode = '42501';
  end if;

  update public.enrollments
  set started_at = coalesce(started_at, now())
  where id = target_enrollment.id;

  insert into public.lesson_progress (
    enrollment_id, lesson_id, status, progress_percent, started_at
  )
  values (
    target_enrollment.id, target_lesson_id, 'in_progress', 0, now()
  )
  on conflict (enrollment_id, lesson_id) do update
  set
    status = case
      when public.lesson_progress.status = 'completed' then 'completed'::public.lesson_progress_status
      else 'in_progress'::public.lesson_progress_status
    end,
    started_at = coalesce(public.lesson_progress.started_at, now())
  returning * into saved_progress;

  return saved_progress;
end;
$$;

create or replace function public.complete_theory_lesson(target_lesson_id uuid)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_enrollment public.enrollments;
  saved_progress public.lesson_progress;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select e.* into target_enrollment
  from public.enrollments e
  join public.modules m on m.course_id = e.course_id
  join public.lessons l on l.module_id = m.id
  where e.user_id = current_user_id
    and l.id = target_lesson_id
    and l.lesson_type = 'theory'
    and e.status in ('active', 'completed')
    and (e.expires_at is null or e.expires_at > now())
  for update of e;

  if target_enrollment.id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment.id, target_lesson_id)
  then
    raise exception 'Theory lesson is locked or unavailable' using errcode = '42501';
  end if;

  update public.enrollments
  set started_at = coalesce(started_at, now())
  where id = target_enrollment.id;

  insert into public.lesson_progress (
    enrollment_id, lesson_id, status, progress_percent, started_at, completed_at
  )
  values (
    target_enrollment.id, target_lesson_id, 'completed', 100, now(), now()
  )
  on conflict (enrollment_id, lesson_id) do update
  set
    status = 'completed',
    progress_percent = 100,
    started_at = coalesce(public.lesson_progress.started_at, now()),
    completed_at = coalesce(public.lesson_progress.completed_at, now())
  returning * into saved_progress;

  return saved_progress;
end;
$$;

create or replace function public.save_video_progress(
  target_lesson_id uuid,
  video_position_seconds integer,
  watched_seconds_delta integer,
  reported_duration_seconds integer
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_enrollment public.enrollments;
  configured_duration integer;
  saved_progress public.lesson_progress;
  allowed_delta integer;
  elapsed_since_save integer;
  next_watched integer;
  next_percent numeric(5, 2);
  completion_reached boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select e.* into target_enrollment
  from public.enrollments e
  join public.modules m on m.course_id = e.course_id
  join public.lessons l on l.module_id = m.id
  where e.user_id = current_user_id
    and l.id = target_lesson_id
    and l.lesson_type = 'video'
    and e.status in ('active', 'completed')
    and (e.expires_at is null or e.expires_at > now())
  for update of e;

  if target_enrollment.id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment.id, target_lesson_id)
  then
    raise exception 'Video lesson is locked or unavailable' using errcode = '42501';
  end if;

  select coalesce(duration_seconds, reported_duration_seconds)
  into configured_duration
  from public.lesson_videos
  where lesson_id = target_lesson_id;

  if configured_duration is null or configured_duration < 1 or configured_duration > 86400 then
    raise exception 'Valid video duration is required' using errcode = '22023';
  end if;

  update public.enrollments
  set started_at = coalesce(started_at, now())
  where id = target_enrollment.id;

  insert into public.lesson_progress (
    enrollment_id, lesson_id, status, progress_percent, last_video_position,
    watched_seconds, started_at
  )
  values (
    target_enrollment.id, target_lesson_id, 'in_progress', 0,
    greatest(0, least(coalesce(video_position_seconds, 0), configured_duration)),
    0, now()
  )
  on conflict (enrollment_id, lesson_id) do nothing;

  select * into saved_progress
  from public.lesson_progress
  where enrollment_id = target_enrollment.id and lesson_id = target_lesson_id
  for update;

  elapsed_since_save := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - saved_progress.updated_at)))::integer
  );
  allowed_delta := least(
    greatest(coalesce(watched_seconds_delta, 0), 0),
    30,
    elapsed_since_save
  );
  next_watched := least(
    configured_duration,
    saved_progress.watched_seconds + allowed_delta
  );
  next_percent := least(
    100,
    round((next_watched::numeric / configured_duration::numeric) * 100, 2)
  );
  completion_reached := next_watched >= ceil(configured_duration * 0.9);

  update public.lesson_progress
  set
    status = case
      when status = 'completed' or completion_reached then 'completed'::public.lesson_progress_status
      else 'in_progress'::public.lesson_progress_status
    end,
    progress_percent = case
      when status = 'completed' or completion_reached then 100
      else next_percent
    end,
    last_video_position = greatest(
      0,
      least(coalesce(video_position_seconds, 0), configured_duration)
    ),
    watched_seconds = greatest(watched_seconds, next_watched),
    started_at = coalesce(started_at, now()),
    completed_at = case
      when status = 'completed' then completed_at
      when completion_reached then now()
      else null
    end
  where id = saved_progress.id
  returning * into saved_progress;

  return saved_progress;
end;
$$;

revoke all on function public.is_lesson_available_for_enrollment(uuid, uuid) from public;
revoke all on function public.start_lesson(uuid) from public;
revoke all on function public.complete_theory_lesson(uuid) from public;
revoke all on function public.save_video_progress(uuid, integer, integer, integer) from public;

grant execute on function public.start_lesson(uuid) to authenticated;
grant execute on function public.complete_theory_lesson(uuid) to authenticated;
grant execute on function public.save_video_progress(uuid, integer, integer, integer) to authenticated;

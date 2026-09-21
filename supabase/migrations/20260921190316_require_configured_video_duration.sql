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

  select duration_seconds
  into configured_duration
  from public.lesson_videos
  where lesson_id = target_lesson_id;

  if configured_duration is null or configured_duration < 1 or configured_duration > 86400 then
    raise exception 'A configured video duration is required' using errcode = '22023';
  end if;

  if reported_duration_seconds is not null
    and reported_duration_seconds > 0
    and abs(reported_duration_seconds - configured_duration) > 5
  then
    raise exception 'Reported video duration does not match configured duration' using errcode = '22023';
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

revoke all on function public.save_video_progress(uuid, integer, integer, integer) from public;
grant execute on function public.save_video_progress(uuid, integer, integer, integer) to authenticated;

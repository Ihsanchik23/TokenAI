create or replace function public.evaluate_course_completion(target_enrollment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_enrollment public.enrollments;
  target_course_title text;
  required_total integer := 0;
  completed_required integer := 0;
  missing_quizzes integer := 0;
  missing_assignments integer := 0;
  progress_percent integer := 0;
  fully_completed boolean := false;
  newly_completed boolean := false;
  saved_certificate public.certificates;
  new_certificate_id uuid;
  new_certificate_code text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select enrollment.* into target_enrollment
  from public.enrollments enrollment
  where enrollment.id = target_enrollment_id
  for update;

  if target_enrollment.id is null
    or not (
      target_enrollment.user_id = current_user_id
      or public.is_course_staff(target_enrollment.course_id)
    )
  then
    raise exception 'Course completion access denied' using errcode = '42501';
  end if;

  select course.title into target_course_title
  from public.courses course
  where course.id = target_enrollment.course_id;

  select count(*) into required_total
  from public.lessons lesson
  join public.modules module on module.id = lesson.module_id
  where module.course_id = target_enrollment.course_id
    and lesson.is_required;

  select count(*) into completed_required
  from public.lessons lesson
  join public.modules module on module.id = lesson.module_id
  where module.course_id = target_enrollment.course_id
    and lesson.is_required
    and exists (
      select 1
      from public.lesson_progress progress
      where progress.enrollment_id = target_enrollment.id
        and progress.lesson_id = lesson.id
        and progress.status = 'completed'
    );

  select count(*) into missing_quizzes
  from public.lessons lesson
  join public.modules module on module.id = lesson.module_id
  where module.course_id = target_enrollment.course_id
    and lesson.is_required
    and lesson.lesson_type = 'quiz'
    and not exists (
      select 1
      from public.quizzes quiz
      join public.quiz_attempts attempt on attempt.quiz_id = quiz.id
      where quiz.lesson_id = lesson.id
        and attempt.user_id = target_enrollment.user_id
        and attempt.completed_at is not null
    );

  select count(*) into missing_assignments
  from public.lessons lesson
  join public.modules module on module.id = lesson.module_id
  where module.course_id = target_enrollment.course_id
    and lesson.is_required
    and lesson.lesson_type = 'assignment'
    and not exists (
      select 1
      from public.assignments assignment
      join public.assignment_submissions submission
        on submission.assignment_id = assignment.id
      where assignment.lesson_id = lesson.id
        and submission.user_id = target_enrollment.user_id
        and submission.status = 'approved'
    );

  progress_percent := case
    when required_total = 0 then 100
    else round((completed_required::numeric / required_total::numeric) * 100)::integer
  end;
  fully_completed := completed_required = required_total
    and missing_quizzes = 0
    and missing_assignments = 0;

  if target_enrollment.status = 'completed' then
    fully_completed := true;
    progress_percent := 100;
  elsif target_enrollment.status = 'active'
    and (target_enrollment.expires_at is null or target_enrollment.expires_at > now())
    and fully_completed
  then
    update public.enrollments
    set
      status = 'completed',
      started_at = coalesce(started_at, now()),
      completed_at = coalesce(completed_at, now())
    where id = target_enrollment.id
    returning * into target_enrollment;

    newly_completed := true;
  else
    fully_completed := false;
  end if;

  if target_enrollment.status = 'completed' then
    select certificate.* into saved_certificate
    from public.certificates certificate
    where certificate.enrollment_id = target_enrollment.id;

    if saved_certificate.id is null then
      new_certificate_id := gen_random_uuid();

      loop
        new_certificate_code := 'TKN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
        begin
          insert into public.certificates (id, enrollment_id, certificate_code)
          values (new_certificate_id, target_enrollment.id, new_certificate_code)
          returning * into saved_certificate;
          exit;
        exception when unique_violation then
          select certificate.* into saved_certificate
          from public.certificates certificate
          where certificate.enrollment_id = target_enrollment.id;

          if saved_certificate.id is not null then
            exit;
          end if;
        end;
      end loop;
    end if;

    if newly_completed then
      insert into public.notifications (user_id, type, title, message, target_url)
      values (
        target_enrollment.user_id,
        'certificate_issued',
        'Курс завершён',
        'Вы завершили курс «' || target_course_title || '». Сертификат готовится.',
        '/certificate/' || saved_certificate.certificate_code
      );
    end if;
  end if;

  return jsonb_build_object(
    'enrollmentId', target_enrollment.id,
    'status', target_enrollment.status,
    'requiredTotal', required_total,
    'completedRequired', completed_required,
    'missingQuizzes', missing_quizzes,
    'missingAssignments', missing_assignments,
    'progressPercent', progress_percent,
    'fullyCompleted', fully_completed,
    'newlyCompleted', newly_completed,
    'completedAt', target_enrollment.completed_at,
    'certificateId', saved_certificate.id,
    'certificateCode', saved_certificate.certificate_code,
    'certificatePdfPath', saved_certificate.pdf_path
  );
end;
$$;

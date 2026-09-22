update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf']::text[]
where id = 'certificates';

drop policy "Users read own certificates" on public.certificates;
drop policy "Staff manage certificates" on public.certificates;

create policy "Owners and course staff read certificates"
on public.certificates for select to authenticated
using (
  exists (
    select 1
    from public.enrollments enrollment
    where enrollment.id = enrollment_id
      and (
        enrollment.user_id = (select auth.uid())
        or public.is_course_staff(enrollment.course_id)
      )
  )
);

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

create or replace function public.evaluate_completion_after_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
    and (tg_op = 'INSERT' or old.status is distinct from 'completed')
  then
    perform public.evaluate_course_completion(new.enrollment_id);
  end if;

  return new;
end;
$$;

create trigger lesson_progress_evaluate_course_completion
after insert or update of status on public.lesson_progress
for each row execute function public.evaluate_completion_after_lesson_progress();

create or replace function public.evaluate_completion_after_assignment_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_enrollment_id uuid;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select enrollment.id into target_enrollment_id
    from public.assignments assignment
    join public.lessons lesson on lesson.id = assignment.lesson_id
    join public.modules module on module.id = lesson.module_id
    join public.enrollments enrollment
      on enrollment.course_id = module.course_id
      and enrollment.user_id = new.user_id
    where assignment.id = new.assignment_id;

    if target_enrollment_id is not null then
      perform public.evaluate_course_completion(target_enrollment_id);
    end if;
  end if;

  return new;
end;
$$;

create trigger assignment_review_evaluate_course_completion
after update of status on public.assignment_submissions
for each row execute function public.evaluate_completion_after_assignment_review();

create or replace function public.can_write_certificate_file(target_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.certificates certificate
    join public.enrollments enrollment on enrollment.id = certificate.enrollment_id
    where target_path = enrollment.user_id::text || '/' || certificate.id::text || '.pdf'
      and enrollment.status = 'completed'
      and (
        enrollment.user_id = (select auth.uid())
        or public.is_course_staff(enrollment.course_id)
      )
  );
$$;

drop policy "Certificate owners read files" on storage.objects;

create policy "Owners and course staff read certificate files"
on storage.objects for select to authenticated
using (
  bucket_id = 'certificates'
  and public.can_write_certificate_file(name)
);

create policy "Authorized server flow creates certificate files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'certificates'
  and public.can_write_certificate_file(name)
  and (metadata ->> 'mimetype') = 'application/pdf'
);

create or replace function public.register_certificate_pdf(target_certificate_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_path text;
begin
  select enrollment.user_id::text || '/' || certificate.id::text || '.pdf'
  into expected_path
  from public.certificates certificate
  join public.enrollments enrollment on enrollment.id = certificate.enrollment_id
  where certificate.id = target_certificate_id
    and enrollment.status = 'completed'
    and (
      enrollment.user_id = (select auth.uid())
      or public.is_course_staff(enrollment.course_id)
    );

  if expected_path is null then
    raise exception 'Certificate access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'certificates'
      and object.name = expected_path
  ) then
    raise exception 'Certificate PDF is missing' using errcode = 'P0001';
  end if;

  update public.certificates
  set pdf_path = expected_path
  where id = target_certificate_id
    and pdf_path is null;

  return expected_path;
end;
$$;

create or replace function public.get_certificate_document_data(target_certificate_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', certificate.id,
    'code', certificate.certificate_code,
    'issuedAt', certificate.issued_at,
    'pdfPath', certificate.pdf_path,
    'ownerId', enrollment.user_id,
    'studentName', coalesce(nullif(btrim(profile.display_name), ''), profile.username::text),
    'courseTitle', course.title,
    'completedAt', enrollment.completed_at,
    'instructorNames', coalesce((
      select jsonb_agg(coalesce(nullif(btrim(instructor.display_name), ''), instructor.username::text) order by instructor.display_name)
      from public.course_instructors course_instructor
      join public.profiles instructor on instructor.id = course_instructor.user_id
      where course_instructor.course_id = course.id
    ), '[]'::jsonb)
  ) into result
  from public.certificates certificate
  join public.enrollments enrollment on enrollment.id = certificate.enrollment_id
  join public.courses course on course.id = enrollment.course_id
  join public.profiles profile on profile.id = enrollment.user_id
  where certificate.id = target_certificate_id
    and enrollment.status = 'completed'
    and (
      enrollment.user_id = (select auth.uid())
      or public.is_course_staff(enrollment.course_id)
    );

  if result is null then
    raise exception 'Certificate access denied' using errcode = '42501';
  end if;

  return result;
end;
$$;

create or replace function public.verify_certificate(target_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'valid', true,
    'code', certificate.certificate_code,
    'studentName', coalesce(nullif(btrim(profile.display_name), ''), profile.username::text),
    'courseTitle', course.title,
    'completedAt', enrollment.completed_at,
    'issuedAt', certificate.issued_at
  )
  from public.certificates certificate
  join public.enrollments enrollment on enrollment.id = certificate.enrollment_id
  join public.courses course on course.id = enrollment.course_id
  join public.profiles profile on profile.id = enrollment.user_id
  where certificate.certificate_code = upper(btrim(target_code))
    and enrollment.status = 'completed';
$$;

revoke all on function public.evaluate_course_completion(uuid) from public;
revoke all on function public.evaluate_completion_after_lesson_progress() from public;
revoke all on function public.evaluate_completion_after_assignment_review() from public;
revoke all on function public.can_write_certificate_file(text) from public;
revoke all on function public.register_certificate_pdf(uuid) from public;
revoke all on function public.get_certificate_document_data(uuid) from public;
revoke all on function public.verify_certificate(text) from public;

grant execute on function public.evaluate_course_completion(uuid) to authenticated;
grant execute on function public.can_write_certificate_file(text) to authenticated;
grant execute on function public.register_certificate_pdf(uuid) to authenticated;
grant execute on function public.get_certificate_document_data(uuid) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;

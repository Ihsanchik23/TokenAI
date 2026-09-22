alter table public.assignment_submissions
  add column client_token uuid;

update public.assignment_submissions
set client_token = gen_random_uuid()
where client_token is null;

alter table public.assignment_submissions
  alter column client_token set not null,
  drop constraint assignment_submissions_answer_present,
  add constraint assignment_submissions_client_token_unique
    unique (assignment_id, user_id, client_token),
  add constraint assignment_submissions_text_length
    check (text_answer is null or length(text_answer) <= 10000),
  add constraint assignment_submissions_link_length
    check (link_url is null or length(link_url) <= 2000),
  add constraint assignment_submissions_comment_length
    check (teacher_comment is null or length(teacher_comment) <= 4000);

alter table public.submission_files
  add column file_size bigint,
  add column mime_type text;

update public.submission_files
set file_size = 0,
    mime_type = 'application/octet-stream'
where file_size is null or mime_type is null;

alter table public.submission_files
  alter column file_size set not null,
  alter column mime_type set not null,
  add constraint submission_files_size_range
    check (file_size between 1 and 10485760),
  add constraint submission_files_name_length
    check (length(file_name) between 1 and 255),
  add constraint submission_files_allowed_mime
    check (mime_type in (
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/zip'
    ));

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip'
  ]::text[]
where id = 'submission-files';

create or replace function public.can_review_assignment_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignment_submissions submission
    join public.assignments assignment on assignment.id = submission.assignment_id
    join public.lessons lesson on lesson.id = assignment.lesson_id
    join public.modules module on module.id = lesson.module_id
    where submission.id = target_submission_id
      and public.is_course_staff(module.course_id)
  );
$$;

drop policy "Users read own assignment submissions" on public.assignment_submissions;
drop policy "Users create own assignment submissions" on public.assignment_submissions;
drop policy "Staff review assignment submissions" on public.assignment_submissions;

create policy "Owners and course staff read assignment submissions"
on public.assignment_submissions for select to authenticated
using (
  user_id = (select auth.uid())
  or public.can_review_assignment_submission(id)
);

drop policy "Users read files for own submissions" on public.submission_files;
drop policy "Users attach files to own submissions" on public.submission_files;
drop policy "Users delete files from own submissions" on public.submission_files;

create policy "Owners and course staff read submission metadata"
on public.submission_files for select to authenticated
using (
  exists (
    select 1
    from public.assignment_submissions submission
    where submission.id = submission_id
      and (
        submission.user_id = (select auth.uid())
        or public.can_review_assignment_submission(submission.id)
      )
  )
);

drop policy "Owners and staff read submission files" on storage.objects;
drop policy "Users upload own submission files" on storage.objects;
drop policy "Users delete own submission files" on storage.objects;

create policy "Owners and course staff read submission files"
on storage.objects for select to authenticated
using (
  bucket_id = 'submission-files'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.submission_files file
      where file.file_path = name
        and public.can_review_assignment_submission(file.submission_id)
    )
  )
);

create policy "Users upload own submission files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users delete unsubmitted own files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'submission-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.submission_files file
    where file.file_path = name
  )
);

create or replace function public.get_assignment_lesson(target_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_assignment_id uuid;
  target_enrollment_id uuid;
  assignment_instructions text;
  assignment_allow_text boolean;
  assignment_allow_link boolean;
  assignment_allow_file boolean;
  assignment_allow_resubmission boolean;
  submissions_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select
    assignment.id,
    enrollment.id,
    assignment.instructions,
    assignment.allow_text,
    assignment.allow_link,
    assignment.allow_file,
    assignment.allow_resubmission
  into
    target_assignment_id,
    target_enrollment_id,
    assignment_instructions,
    assignment_allow_text,
    assignment_allow_link,
    assignment_allow_file,
    assignment_allow_resubmission
  from public.assignments assignment
  join public.lessons lesson on lesson.id = assignment.lesson_id
  join public.modules module on module.id = lesson.module_id
  join public.enrollments enrollment on enrollment.course_id = module.course_id
  where assignment.lesson_id = target_lesson_id
    and lesson.lesson_type = 'assignment'
    and enrollment.user_id = current_user_id
    and enrollment.status in ('active', 'completed')
    and (enrollment.expires_at is null or enrollment.expires_at > now());

  if target_assignment_id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment_id, target_lesson_id)
  then
    raise exception 'Assignment is locked or enrollment is inactive' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', submission.id,
      'attemptNumber', submission.attempt_number,
      'textAnswer', submission.text_answer,
      'linkUrl', submission.link_url,
      'status', submission.status,
      'teacherComment', submission.teacher_comment,
      'submittedAt', submission.submitted_at,
      'reviewedAt', submission.reviewed_at,
      'files', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', file.id,
            'path', file.file_path,
            'name', file.file_name,
            'size', file.file_size,
            'mimeType', file.mime_type
          ) order by file.file_name
        ), '[]'::jsonb)
        from public.submission_files file
        where file.submission_id = submission.id
      )
    ) order by submission.attempt_number desc
  ), '[]'::jsonb)
  into submissions_payload
  from public.assignment_submissions submission
  where submission.assignment_id = target_assignment_id
    and submission.user_id = current_user_id;

  return jsonb_build_object(
    'assignmentId', target_assignment_id,
    'instructions', assignment_instructions,
    'allowText', assignment_allow_text,
    'allowLink', assignment_allow_link,
    'allowFile', assignment_allow_file,
    'allowResubmission', assignment_allow_resubmission,
    'submissions', submissions_payload,
    'approvedAttemptExists', exists (
      select 1
      from public.assignment_submissions submission
      where submission.assignment_id = target_assignment_id
        and submission.user_id = current_user_id
        and submission.status = 'approved'
    )
  );
end;
$$;

create or replace function public.submit_assignment(
  target_assignment_id uuid,
  request_token uuid,
  answer_text text,
  answer_link text,
  uploaded_files jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_lesson_id uuid;
  target_enrollment_id uuid;
  assignment_allow_text boolean;
  assignment_allow_link boolean;
  assignment_allow_file boolean;
  assignment_allow_resubmission boolean;
  normalized_text text := nullif(btrim(coalesce(answer_text, '')), '');
  normalized_link text := nullif(btrim(coalesce(answer_link, '')), '');
  files_payload jsonb := coalesce(uploaded_files, '[]'::jsonb);
  file_count integer;
  latest_submission public.assignment_submissions;
  existing_submission public.assignment_submissions;
  saved_submission public.assignment_submissions;
  next_attempt integer;
  file_row record;
  stored_size bigint;
  stored_mime text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if request_token is null then
    raise exception 'Submission token is required' using errcode = '22023';
  end if;

  select submission.* into existing_submission
  from public.assignment_submissions submission
  where submission.assignment_id = target_assignment_id
    and submission.user_id = current_user_id
    and submission.client_token = request_token;

  if existing_submission.id is not null then
    return jsonb_build_object(
      'id', existing_submission.id,
      'attemptNumber', existing_submission.attempt_number,
      'status', existing_submission.status,
      'reused', true
    );
  end if;

  select
    assignment.lesson_id,
    enrollment.id,
    assignment.allow_text,
    assignment.allow_link,
    assignment.allow_file,
    assignment.allow_resubmission
  into
    target_lesson_id,
    target_enrollment_id,
    assignment_allow_text,
    assignment_allow_link,
    assignment_allow_file,
    assignment_allow_resubmission
  from public.assignments assignment
  join public.lessons lesson on lesson.id = assignment.lesson_id
  join public.modules module on module.id = lesson.module_id
  join public.enrollments enrollment on enrollment.course_id = module.course_id
  where assignment.id = target_assignment_id
    and lesson.lesson_type = 'assignment'
    and enrollment.user_id = current_user_id
    and enrollment.status in ('active', 'completed')
    and (enrollment.expires_at is null or enrollment.expires_at > now())
  for update of enrollment;

  if target_lesson_id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment_id, target_lesson_id)
  then
    raise exception 'Assignment is locked or enrollment is inactive' using errcode = '42501';
  end if;

  if jsonb_typeof(files_payload) <> 'array' then
    raise exception 'Uploaded files must be an array' using errcode = '22023';
  end if;

  file_count := jsonb_array_length(files_payload);

  if file_count > 5
    or (normalized_text is not null and not assignment_allow_text)
    or (normalized_link is not null and not assignment_allow_link)
    or (file_count > 0 and not assignment_allow_file)
    or (normalized_text is null and normalized_link is null and file_count = 0)
  then
    raise exception 'Submission methods are invalid' using errcode = '22023';
  end if;

  if normalized_text is not null and length(normalized_text) > 10000 then
    raise exception 'Text answer is too long' using errcode = '22023';
  end if;

  if normalized_link is not null and (
    length(normalized_link) > 2000
    or normalized_link !~* '^https?://[^[:space:]]+$'
  ) then
    raise exception 'Submission URL is invalid' using errcode = '22023';
  end if;

  select submission.* into latest_submission
  from public.assignment_submissions submission
  where submission.assignment_id = target_assignment_id
    and submission.user_id = current_user_id
  order by submission.attempt_number desc
  limit 1;

  if latest_submission.id is not null and (
    not assignment_allow_resubmission
    or latest_submission.status <> 'needs_revision'
  ) then
    raise exception 'Resubmission is not allowed' using errcode = 'P0001';
  end if;

  next_attempt := coalesce(latest_submission.attempt_number, 0) + 1;

  insert into public.assignment_submissions (
    assignment_id,
    user_id,
    attempt_number,
    client_token,
    text_answer,
    link_url,
    status
  ) values (
    target_assignment_id,
    current_user_id,
    next_attempt,
    request_token,
    normalized_text,
    normalized_link,
    'submitted'
  )
  returning * into saved_submission;

  for file_row in
    select
      value ->> 'path' as file_path,
      value ->> 'name' as file_name
    from jsonb_array_elements(files_payload)
  loop
    if file_row.file_path is null
      or file_row.file_name is null
      or length(file_row.file_name) not between 1 and 255
      or file_row.file_name ~ '[/\\]'
      or file_row.file_path like '%..%'
      or file_row.file_path not like (
        current_user_id::text || '/' || target_assignment_id::text || '/' || request_token::text || '/%'
      )
    then
      raise exception 'Submission file path is invalid' using errcode = '22023';
    end if;

    select
      (object.metadata ->> 'size')::bigint,
      object.metadata ->> 'mimetype'
    into stored_size, stored_mime
    from storage.objects object
    where object.bucket_id = 'submission-files'
      and object.name = file_row.file_path;

    if stored_size is null
      or stored_size not between 1 and 10485760
      or stored_mime not in (
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/zip'
      )
    then
      raise exception 'Submission file is missing or invalid' using errcode = '22023';
    end if;

    insert into public.submission_files (
      submission_id,
      file_path,
      file_name,
      file_size,
      mime_type
    ) values (
      saved_submission.id,
      file_row.file_path,
      file_row.file_name,
      stored_size,
      stored_mime
    );
  end loop;

  if (
    select count(distinct file.file_path)
    from public.submission_files file
    where file.submission_id = saved_submission.id
  ) <> file_count then
    raise exception 'Duplicate submission files are not allowed' using errcode = '22023';
  end if;

  update public.enrollments
  set started_at = coalesce(started_at, now())
  where id = target_enrollment_id;

  insert into public.lesson_progress (
    enrollment_id, lesson_id, status, progress_percent, started_at, completed_at
  ) values (
    target_enrollment_id, target_lesson_id, 'completed', 100, now(), now()
  )
  on conflict (enrollment_id, lesson_id) do update
  set
    status = 'completed',
    progress_percent = 100,
    started_at = coalesce(public.lesson_progress.started_at, now()),
    completed_at = coalesce(public.lesson_progress.completed_at, now());

  return jsonb_build_object(
    'id', saved_submission.id,
    'attemptNumber', saved_submission.attempt_number,
    'status', saved_submission.status,
    'reused', false
  );
end;
$$;

create or replace function public.review_assignment_submission(
  target_submission_id uuid,
  next_status public.assignment_submission_status,
  review_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_submission public.assignment_submissions;
  submission_user_id uuid;
  target_course_id uuid;
  target_course_slug text;
  target_lesson_id uuid;
  target_lesson_title text;
  normalized_comment text := nullif(btrim(coalesce(review_comment, '')), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select submission.* into target_submission
  from public.assignment_submissions submission
  where submission.id = target_submission_id
  for update;

  submission_user_id := target_submission.user_id;

  select
    module.course_id,
    course.slug,
    lesson.id,
    lesson.title
  into
    target_course_id,
    target_course_slug,
    target_lesson_id,
    target_lesson_title
  from public.assignments assignment
  join public.lessons lesson on lesson.id = assignment.lesson_id
  join public.modules module on module.id = lesson.module_id
  join public.courses course on course.id = module.course_id
  where assignment.id = target_submission.assignment_id;

  if target_submission.id is null
    or not public.is_course_staff(target_course_id)
    or submission_user_id = current_user_id
  then
    raise exception 'Assignment review access denied' using errcode = '42501';
  end if;

  if next_status not in ('approved', 'needs_revision') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  if normalized_comment is not null and length(normalized_comment) > 4000 then
    raise exception 'Teacher comment is too long' using errcode = '22023';
  end if;

  if next_status = 'needs_revision' and normalized_comment is null then
    raise exception 'Teacher comment is required for revision' using errcode = '22023';
  end if;

  if target_submission.reviewed_at is not null
    and target_submission.status = next_status
    and target_submission.teacher_comment is not distinct from normalized_comment
  then
    return jsonb_build_object(
      'id', target_submission.id,
      'status', target_submission.status,
      'reused', true
    );
  end if;

  if target_submission.status <> 'submitted' then
    raise exception 'Submission was already reviewed' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.assignment_submissions newer
    where newer.assignment_id = target_submission.assignment_id
      and newer.user_id = target_submission.user_id
      and newer.attempt_number > target_submission.attempt_number
  ) then
    raise exception 'Only the latest submission can be reviewed' using errcode = 'P0001';
  end if;

  update public.assignment_submissions
  set
    status = next_status,
    teacher_comment = normalized_comment,
    reviewed_at = now(),
    reviewed_by = current_user_id
  where id = target_submission.id
  returning * into target_submission;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    target_url
  ) values (
    submission_user_id,
    case
      when next_status = 'approved' then 'assignment_approved'::public.notification_type
      else 'assignment_revision'::public.notification_type
    end,
    case
      when next_status = 'approved' then 'Задание принято'
      else 'Задание требует доработки'
    end,
    case
      when next_status = 'approved' then 'Преподаватель принял задание «' || target_lesson_title || '».'
      else 'Преподаватель оставил комментарий к заданию «' || target_lesson_title || '».'
    end,
    '/learn/' || target_course_slug || '/' || target_lesson_id::text
  );

  return jsonb_build_object(
    'id', target_submission.id,
    'status', target_submission.status,
    'reviewedAt', target_submission.reviewed_at,
    'reused', false
  );
end;
$$;

revoke all on function public.can_review_assignment_submission(uuid) from public;
revoke all on function public.get_assignment_lesson(uuid) from public;
revoke all on function public.submit_assignment(uuid, uuid, text, text, jsonb) from public;
revoke all on function public.review_assignment_submission(uuid, public.assignment_submission_status, text) from public;

grant execute on function public.can_review_assignment_submission(uuid) to authenticated;
grant execute on function public.get_assignment_lesson(uuid) to authenticated;
grant execute on function public.submit_assignment(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.review_assignment_submission(uuid, public.assignment_submission_status, text) to authenticated;

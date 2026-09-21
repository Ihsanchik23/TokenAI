drop policy "Users create own quiz attempts" on public.quiz_attempts;
drop policy "Users manage answers for own attempts" on public.quiz_attempt_answers;

create policy "Users read own completed quiz answers"
on public.quiz_attempt_answers for select to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts attempt
    where attempt.id = attempt_id
      and attempt.user_id = (select auth.uid())
      and attempt.completed_at is not null
  )
);

create policy "Staff manage quiz attempt answers"
on public.quiz_attempt_answers for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create unique index quiz_attempts_one_active_per_user_idx
on public.quiz_attempts (quiz_id, user_id)
where completed_at is null;

create or replace function public.get_quiz_lesson(target_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_quiz_id uuid;
  target_max_attempts integer;
  target_enrollment_id uuid;
  question_count integer;
  attempt_count integer;
  configuration_valid boolean;
  questions_payload jsonb;
  attempts_payload jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select quiz.id, quiz.max_attempts, enrollment.id
  into target_quiz_id, target_max_attempts, target_enrollment_id
  from public.quizzes quiz
  join public.lessons lesson on lesson.id = quiz.lesson_id
  join public.modules module on module.id = lesson.module_id
  join public.enrollments enrollment on enrollment.course_id = module.course_id
  where quiz.lesson_id = target_lesson_id
    and lesson.lesson_type = 'quiz'
    and enrollment.user_id = current_user_id
    and enrollment.status in ('active', 'completed')
    and (enrollment.expires_at is null or enrollment.expires_at > now());

  if target_quiz_id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment_id, target_lesson_id)
  then
    raise exception 'Quiz is locked or enrollment is inactive' using errcode = '42501';
  end if;

  select count(*) into question_count
  from public.quiz_questions question
  where question.quiz_id = target_quiz_id;

  configuration_valid := question_count > 0 and not exists (
    select 1
    from public.quiz_questions question
    left join public.quiz_options option on option.question_id = question.id
    where question.quiz_id = target_quiz_id
    group by question.id, question.question_type
    having count(option.id) < 2
      or (
        question.question_type in ('single', 'boolean')
        and count(option.id) filter (where option.is_correct) <> 1
      )
      or (
        question.question_type = 'multiple'
        and count(option.id) filter (where option.is_correct) < 1
      )
      or (question.question_type = 'boolean' and count(option.id) <> 2)
  );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', question.id,
      'question', question.question,
      'questionType', question.question_type,
      'position', question.position,
      'options', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', option.id,
            'text', option.text,
            'position', option.position
          ) order by option.position
        ), '[]'::jsonb)
        from public.quiz_options option
        where option.question_id = question.id
      )
    ) order by question.position
  ), '[]'::jsonb)
  into questions_payload
  from public.quiz_questions question
  where question.quiz_id = target_quiz_id;

  select count(*) into attempt_count
  from public.quiz_attempts attempt
  where attempt.quiz_id = target_quiz_id
    and attempt.user_id = current_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', attempt.id,
      'attemptNumber', attempt.attempt_number,
      'score', attempt.score,
      'percentage', attempt.percentage,
      'startedAt', attempt.started_at,
      'completedAt', attempt.completed_at
    ) order by attempt.attempt_number desc
  ), '[]'::jsonb)
  into attempts_payload
  from public.quiz_attempts attempt
  where attempt.quiz_id = target_quiz_id
    and attempt.user_id = current_user_id;

  return jsonb_build_object(
    'quizId', target_quiz_id,
    'maxAttempts', target_max_attempts,
    'questionCount', question_count,
    'configurationValid', configuration_valid,
    'questions', questions_payload,
    'attempts', attempts_payload,
    'activeAttemptId', (
      select attempt.id
      from public.quiz_attempts attempt
      where attempt.quiz_id = target_quiz_id
        and attempt.user_id = current_user_id
        and attempt.completed_at is null
      limit 1
    ),
    'remainingAttempts', case
      when target_max_attempts is null then null
      else greatest(target_max_attempts - attempt_count, 0)
    end
  );
end;
$$;

create or replace function public.start_quiz_attempt(target_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_quiz_id uuid;
  target_max_attempts integer;
  target_enrollment_id uuid;
  active_attempt public.quiz_attempts;
  saved_attempt public.quiz_attempts;
  attempt_count integer;
  next_attempt_number integer;
  question_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select quiz.id, quiz.max_attempts, enrollment.id
  into target_quiz_id, target_max_attempts, target_enrollment_id
  from public.quizzes quiz
  join public.lessons lesson on lesson.id = quiz.lesson_id
  join public.modules module on module.id = lesson.module_id
  join public.enrollments enrollment on enrollment.course_id = module.course_id
  where quiz.lesson_id = target_lesson_id
    and lesson.lesson_type = 'quiz'
    and enrollment.user_id = current_user_id
    and enrollment.status in ('active', 'completed')
    and (enrollment.expires_at is null or enrollment.expires_at > now())
  for update of enrollment;

  if target_quiz_id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment_id, target_lesson_id)
  then
    raise exception 'Quiz is locked or enrollment is inactive' using errcode = '42501';
  end if;

  select count(*) into question_count
  from public.quiz_questions question
  where question.quiz_id = target_quiz_id;

  if question_count = 0 or exists (
    select 1
    from public.quiz_questions question
    left join public.quiz_options option on option.question_id = question.id
    where question.quiz_id = target_quiz_id
    group by question.id, question.question_type
    having count(option.id) < 2
      or (
        question.question_type in ('single', 'boolean')
        and count(option.id) filter (where option.is_correct) <> 1
      )
      or (
        question.question_type = 'multiple'
        and count(option.id) filter (where option.is_correct) < 1
      )
      or (question.question_type = 'boolean' and count(option.id) <> 2)
  ) then
    raise exception 'Quiz configuration is invalid' using errcode = '22023';
  end if;

  select attempt.* into active_attempt
  from public.quiz_attempts attempt
  where attempt.quiz_id = target_quiz_id
    and attempt.user_id = current_user_id
    and attempt.completed_at is null
  limit 1;

  if active_attempt.id is not null then
    return jsonb_build_object(
      'id', active_attempt.id,
      'attemptNumber', active_attempt.attempt_number,
      'reused', true
    );
  end if;

  select count(*), coalesce(max(attempt.attempt_number), 0) + 1
  into attempt_count, next_attempt_number
  from public.quiz_attempts attempt
  where attempt.quiz_id = target_quiz_id
    and attempt.user_id = current_user_id;

  if target_max_attempts is not null and attempt_count >= target_max_attempts then
    raise exception 'Maximum quiz attempts reached' using errcode = 'P0001';
  end if;

  perform public.start_lesson(target_lesson_id);

  insert into public.quiz_attempts (quiz_id, user_id, attempt_number)
  values (target_quiz_id, current_user_id, next_attempt_number)
  returning * into saved_attempt;

  return jsonb_build_object(
    'id', saved_attempt.id,
    'attemptNumber', saved_attempt.attempt_number,
    'reused', false
  );
end;
$$;

create or replace function public.submit_quiz_attempt(
  target_attempt_id uuid,
  submitted_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_attempt public.quiz_attempts;
  target_lesson_id uuid;
  target_enrollment_id uuid;
  question_row record;
  answer_payload jsonb;
  question_count integer;
  selected_count integer;
  distinct_selected_count integer;
  valid_selected_count integer;
  correct_count integer := 0;
  calculated_percentage numeric(5, 2);
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select attempt.* into target_attempt
  from public.quiz_attempts attempt
  where attempt.id = target_attempt_id
    and attempt.user_id = current_user_id
  for update;

  if target_attempt.id is null then
    raise exception 'Quiz attempt not found' using errcode = '42501';
  end if;

  if target_attempt.completed_at is not null then
    return jsonb_build_object(
      'id', target_attempt.id,
      'attemptNumber', target_attempt.attempt_number,
      'score', target_attempt.score,
      'percentage', target_attempt.percentage,
      'completedAt', target_attempt.completed_at,
      'reused', true
    );
  end if;

  select quiz.lesson_id
  into target_lesson_id
  from public.quizzes quiz
  where quiz.id = target_attempt.quiz_id;

  select enrollment.id into target_enrollment_id
  from public.enrollments enrollment
  join public.modules module on module.course_id = enrollment.course_id
  join public.lessons lesson
    on lesson.module_id = module.id
    and lesson.id = target_lesson_id
  where enrollment.user_id = current_user_id
    and enrollment.status in ('active', 'completed')
    and (enrollment.expires_at is null or enrollment.expires_at > now())
  for update of enrollment;

  if target_enrollment_id is null
    or not public.is_lesson_available_for_enrollment(target_enrollment_id, target_lesson_id)
  then
    raise exception 'Quiz is locked or enrollment is inactive' using errcode = '42501';
  end if;

  if jsonb_typeof(submitted_answers) <> 'array' then
    raise exception 'Answers must be an array' using errcode = '22023';
  end if;

  select count(*) into question_count
  from public.quiz_questions question
  where question.quiz_id = target_attempt.quiz_id;

  if question_count = 0 or jsonb_array_length(submitted_answers) <> question_count then
    raise exception 'Every quiz question must be answered' using errcode = '22023';
  end if;

  for question_row in
    select question.id, question.question_type
    from public.quiz_questions question
    where question.quiz_id = target_attempt.quiz_id
    order by question.position
  loop
    select answer.value into answer_payload
    from jsonb_array_elements(submitted_answers) answer(value)
    where answer.value ->> 'questionId' = question_row.id::text;

    if answer_payload is null
      or jsonb_typeof(answer_payload -> 'optionIds') <> 'array'
      or (
        select count(*)
        from jsonb_array_elements(submitted_answers) answer(value)
        where answer.value ->> 'questionId' = question_row.id::text
      ) <> 1
    then
      raise exception 'Every quiz question must have one answer entry' using errcode = '22023';
    end if;

    selected_count := jsonb_array_length(answer_payload -> 'optionIds');

    select count(distinct selected.value)
    into distinct_selected_count
    from jsonb_array_elements_text(answer_payload -> 'optionIds') selected(value);

    select count(*) into valid_selected_count
    from public.quiz_options option
    where option.question_id = question_row.id
      and option.id::text in (
        select selected.value
        from jsonb_array_elements_text(answer_payload -> 'optionIds') selected(value)
      );

    if selected_count = 0
      or selected_count <> distinct_selected_count
      or selected_count <> valid_selected_count
      or (question_row.question_type in ('single', 'boolean') and selected_count <> 1)
    then
      raise exception 'Submitted quiz options are invalid' using errcode = '22023';
    end if;

    insert into public.quiz_attempt_answers (attempt_id, question_id, option_id)
    select target_attempt.id, question_row.id, option.id
    from public.quiz_options option
    where option.question_id = question_row.id
      and option.id::text in (
        select selected.value
        from jsonb_array_elements_text(answer_payload -> 'optionIds') selected(value)
      );

    if not exists (
      select 1
      from public.quiz_options option
      where option.question_id = question_row.id
        and option.is_correct
        and option.id::text not in (
          select selected.value
          from jsonb_array_elements_text(answer_payload -> 'optionIds') selected(value)
        )
    ) and not exists (
      select 1
      from jsonb_array_elements_text(answer_payload -> 'optionIds') selected(value)
      where not exists (
        select 1
        from public.quiz_options option
        where option.question_id = question_row.id
          and option.id::text = selected.value
          and option.is_correct
      )
    ) then
      correct_count := correct_count + 1;
    end if;
  end loop;

  calculated_percentage := round((correct_count::numeric / question_count::numeric) * 100, 2);

  update public.quiz_attempts
  set
    score = correct_count,
    percentage = calculated_percentage,
    completed_at = now()
  where id = target_attempt.id
  returning * into target_attempt;

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
    'id', target_attempt.id,
    'attemptNumber', target_attempt.attempt_number,
    'score', target_attempt.score,
    'percentage', target_attempt.percentage,
    'completedAt', target_attempt.completed_at,
    'reused', false
  );
end;
$$;

revoke all on function public.get_quiz_lesson(uuid) from public;
revoke all on function public.start_quiz_attempt(uuid) from public;
revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public;

grant execute on function public.get_quiz_lesson(uuid) to authenticated;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

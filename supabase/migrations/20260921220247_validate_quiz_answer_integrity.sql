create or replace function public.is_quiz_configuration_valid(target_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quiz_questions question
    where question.quiz_id = target_quiz_id
  ) and not exists (
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
$$;

create or replace function public.validate_quiz_attempt_answer_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_quiz_id uuid;
  answer_quiz_id uuid;
begin
  select attempt.quiz_id into attempt_quiz_id
  from public.quiz_attempts attempt
  where attempt.id = new.attempt_id;

  select question.quiz_id into answer_quiz_id
  from public.quiz_questions question
  where question.id = new.question_id;

  if attempt_quiz_id is null
    or answer_quiz_id is null
    or attempt_quiz_id <> answer_quiz_id
    or not exists (
      select 1 from public.quiz_options option
      where option.id = new.option_id
        and option.question_id = new.question_id
    )
    or not public.is_quiz_configuration_valid(attempt_quiz_id)
  then
    raise exception 'Quiz answer or configuration is invalid' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger quiz_attempt_answers_validate_integrity
before insert or update on public.quiz_attempt_answers
for each row execute function public.validate_quiz_attempt_answer_integrity();

revoke all on function public.is_quiz_configuration_valid(uuid) from public;
revoke all on function public.validate_quiz_attempt_answer_integrity() from public;

alter table public.courses
add column created_by uuid references auth.users (id) on delete set null;

create index courses_created_by_idx on public.courses (created_by);

alter table public.modules
drop constraint modules_course_id_position_key,
add constraint modules_course_id_position_key
  unique (course_id, position) deferrable initially immediate;

alter table public.lessons
drop constraint lessons_module_id_position_key,
add constraint lessons_module_id_position_key
  unique (module_id, position) deferrable initially immediate;

alter table public.lesson_videos
drop constraint lesson_videos_provider_mvp,
add constraint lesson_videos_provider_mvp
  check (provider in ('youtube', 'youtube_unlisted'));

update storage.buckets
set
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'course-covers';

create or replace function public.is_course_staff(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.courses
      where id = target_course_id
        and created_by = (select auth.uid())
    )
    or exists (
      select 1
      from public.course_instructors
      where course_id = target_course_id
        and user_id = (select auth.uid())
    );
$$;

drop policy "Staff create courses" on public.courses;
create policy "Staff create own courses"
on public.courses for insert to authenticated
with check (public.is_staff() and created_by = (select auth.uid()));

drop policy "Staff manage course instructors" on public.course_instructors;
create policy "Course staff manage instructors"
on public.course_instructors for all to authenticated
using (public.is_course_staff(course_id))
with check (public.is_course_staff(course_id));

create or replace function public.create_course_with_relations(
  course_title text,
  course_slug text,
  course_short_description text,
  course_description text,
  course_access_type public.course_access_type,
  course_price_amount numeric,
  course_currency text,
  course_level public.course_level,
  course_estimated_minutes integer,
  selected_topic_ids uuid[],
  selected_instructor_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_course_id uuid;
  normalized_slug text := lower(btrim(course_slug));
  normalized_price numeric := case
    when course_access_type = 'free' then 0
    else course_price_amount
  end;
begin
  if current_user_id is null or not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  if length(btrim(course_title)) = 0
    or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'Invalid title or slug' using errcode = '22023';
  end if;

  if course_access_type = 'paid' and (normalized_price is null or normalized_price <= 0) then
    raise exception 'Paid courses require a positive price' using errcode = '22023';
  end if;

  if normalized_price is not null and normalized_price < 0 then
    raise exception 'Price cannot be negative' using errcode = '22023';
  end if;

  if cardinality(coalesce(selected_instructor_ids, '{}'::uuid[])) = 0 then
    raise exception 'At least one instructor is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(selected_instructor_ids, '{}'::uuid[])) selected(id)
    left join public.profiles p on p.id = selected.id and p.role in ('admin', 'instructor')
    where p.id is null
  ) then
    raise exception 'Invalid instructor' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(selected_topic_ids, '{}'::uuid[])) selected(id)
    left join public.topics t on t.id = selected.id
    where t.id is null
  ) then
    raise exception 'Invalid topic' using errcode = '22023';
  end if;

  insert into public.courses (
    title,
    slug,
    short_description,
    description,
    status,
    access_type,
    price_amount,
    currency,
    level,
    estimated_minutes,
    created_by
  )
  values (
    btrim(course_title),
    normalized_slug,
    nullif(btrim(coalesce(course_short_description, '')), ''),
    nullif(btrim(coalesce(course_description, '')), ''),
    'draft',
    course_access_type,
    normalized_price,
    upper(coalesce(nullif(btrim(course_currency), ''), 'KZT')),
    course_level,
    course_estimated_minutes,
    current_user_id
  )
  returning id into new_course_id;

  insert into public.course_topics (course_id, topic_id)
  select new_course_id, selected.id
  from (
    select distinct unnest(coalesce(selected_topic_ids, '{}'::uuid[])) as id
  ) selected;

  insert into public.course_instructors (course_id, user_id)
  select new_course_id, selected.id
  from (
    select distinct unnest(selected_instructor_ids) as id
  ) selected;

  return new_course_id;
end;
$$;

create or replace function public.update_course_with_relations(
  target_course_id uuid,
  course_title text,
  course_slug text,
  course_short_description text,
  course_description text,
  course_access_type public.course_access_type,
  course_price_amount numeric,
  course_currency text,
  course_level public.course_level,
  course_estimated_minutes integer,
  selected_topic_ids uuid[],
  selected_instructor_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_slug text := lower(btrim(course_slug));
  normalized_price numeric := case
    when course_access_type = 'free' then 0
    else course_price_amount
  end;
begin
  if not public.is_course_staff(target_course_id) then
    raise exception 'Course access denied' using errcode = '42501';
  end if;

  if length(btrim(course_title)) = 0
    or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception 'Invalid title or slug' using errcode = '22023';
  end if;

  if course_access_type = 'paid' and (normalized_price is null or normalized_price <= 0) then
    raise exception 'Paid courses require a positive price' using errcode = '22023';
  end if;

  if normalized_price is not null and normalized_price < 0 then
    raise exception 'Price cannot be negative' using errcode = '22023';
  end if;

  if cardinality(coalesce(selected_instructor_ids, '{}'::uuid[])) = 0 then
    raise exception 'At least one instructor is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(selected_instructor_ids, '{}'::uuid[])) selected(id)
    left join public.profiles p on p.id = selected.id and p.role in ('admin', 'instructor')
    where p.id is null
  ) then
    raise exception 'Invalid instructor' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(coalesce(selected_topic_ids, '{}'::uuid[])) selected(id)
    left join public.topics t on t.id = selected.id
    where t.id is null
  ) then
    raise exception 'Invalid topic' using errcode = '22023';
  end if;

  update public.courses
  set
    title = btrim(course_title),
    slug = normalized_slug,
    short_description = nullif(btrim(coalesce(course_short_description, '')), ''),
    description = nullif(btrim(coalesce(course_description, '')), ''),
    access_type = course_access_type,
    price_amount = normalized_price,
    currency = upper(coalesce(nullif(btrim(course_currency), ''), 'KZT')),
    level = course_level,
    estimated_minutes = course_estimated_minutes
  where id = target_course_id;

  if not found then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  delete from public.course_topics where course_id = target_course_id;
  insert into public.course_topics (course_id, topic_id)
  select target_course_id, selected.id
  from (
    select distinct unnest(coalesce(selected_topic_ids, '{}'::uuid[])) as id
  ) selected;

  delete from public.course_instructors where course_id = target_course_id;
  insert into public.course_instructors (course_id, user_id)
  select target_course_id, selected.id
  from (
    select distinct unnest(selected_instructor_ids) as id
  ) selected;
end;
$$;

create or replace function public.save_course_module(
  target_module_id uuid,
  target_course_id uuid,
  module_title text,
  module_description text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_module_id uuid;
begin
  if not public.is_course_staff(target_course_id) then
    raise exception 'Course access denied' using errcode = '42501';
  end if;

  if length(btrim(module_title)) = 0 then
    raise exception 'Module title is required' using errcode = '22023';
  end if;

  if target_module_id is null then
    insert into public.modules (course_id, title, description, position)
    values (
      target_course_id,
      btrim(module_title),
      nullif(btrim(coalesce(module_description, '')), ''),
      coalesce((select max(position) + 1 from public.modules where course_id = target_course_id), 1)
    )
    returning id into saved_module_id;
  else
    update public.modules
    set
      title = btrim(module_title),
      description = nullif(btrim(coalesce(module_description, '')), '')
    where id = target_module_id and course_id = target_course_id
    returning id into saved_module_id;

    if saved_module_id is null then
      raise exception 'Module not found' using errcode = 'P0002';
    end if;
  end if;

  return saved_module_id;
end;
$$;

create or replace function public.move_course_module(
  target_module_id uuid,
  move_direction text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_course_id uuid;
  current_position integer;
  adjacent_module_id uuid;
  adjacent_position integer;
begin
  select course_id, position into parent_course_id, current_position
  from public.modules where id = target_module_id;

  if parent_course_id is null or not public.is_course_staff(parent_course_id) then
    raise exception 'Module access denied' using errcode = '42501';
  end if;

  if move_direction not in ('up', 'down') then
    raise exception 'Invalid direction' using errcode = '22023';
  end if;

  select id, position into adjacent_module_id, adjacent_position
  from public.modules
  where course_id = parent_course_id
    and (
      (move_direction = 'up' and position < current_position)
      or (move_direction = 'down' and position > current_position)
    )
  order by
    case when move_direction = 'up' then position end desc,
    case when move_direction = 'down' then position end asc
  limit 1;

  if adjacent_module_id is null then
    return;
  end if;

  set constraints modules_course_id_position_key deferred;

  update public.modules
  set position = case
    when id = target_module_id then adjacent_position
    when id = adjacent_module_id then current_position
  end
  where id in (target_module_id, adjacent_module_id);
end;
$$;

create or replace function public.delete_course_module(target_module_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_course_id uuid;
  removed_position integer;
begin
  set constraints modules_course_id_position_key deferred;

  select course_id, position into parent_course_id, removed_position
  from public.modules where id = target_module_id;

  if parent_course_id is null or not public.is_course_staff(parent_course_id) then
    raise exception 'Module access denied' using errcode = '42501';
  end if;

  delete from public.modules where id = target_module_id;

  update public.modules
  set position = position - 1
  where course_id = parent_course_id and position > removed_position;
end;
$$;

create or replace function public.save_course_lesson(
  target_lesson_id uuid,
  target_module_id uuid,
  lesson_title text,
  lesson_description text,
  lesson_kind public.lesson_type,
  lesson_is_required boolean,
  lesson_is_preview boolean,
  lesson_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_course_id uuid;
  saved_lesson_id uuid;
  existing_kind public.lesson_type;
  saved_quiz_id uuid;
  question_row record;
  option_row record;
  saved_question_id uuid;
  question_kind public.quiz_question_type;
  correct_count integer;
  option_count integer;
begin
  select course_id into parent_course_id
  from public.modules where id = target_module_id;

  if parent_course_id is null or not public.is_course_staff(parent_course_id) then
    raise exception 'Course access denied' using errcode = '42501';
  end if;

  if length(btrim(lesson_title)) = 0 then
    raise exception 'Lesson title is required' using errcode = '22023';
  end if;

  if target_lesson_id is null then
    insert into public.lessons (
      module_id, title, description, lesson_type, position, is_required, is_preview
    )
    values (
      target_module_id,
      btrim(lesson_title),
      nullif(btrim(coalesce(lesson_description, '')), ''),
      lesson_kind,
      coalesce((select max(position) + 1 from public.lessons where module_id = target_module_id), 1),
      lesson_is_required,
      lesson_is_preview
    )
    returning id into saved_lesson_id;
  else
    select lesson_type into existing_kind
    from public.lessons
    where id = target_lesson_id and module_id = target_module_id;

    if existing_kind is null then
      raise exception 'Lesson not found' using errcode = 'P0002';
    end if;

    if existing_kind <> lesson_kind then
      raise exception 'Lesson type cannot be changed' using errcode = '22023';
    end if;

    update public.lessons
    set
      title = btrim(lesson_title),
      description = nullif(btrim(coalesce(lesson_description, '')), ''),
      is_required = lesson_is_required,
      is_preview = lesson_is_preview
    where id = target_lesson_id
    returning id into saved_lesson_id;
  end if;

  case lesson_kind
    when 'theory' then
      insert into public.lesson_theory (lesson_id, content_json)
      values (
        saved_lesson_id,
        jsonb_build_object(
          'format', 'markdown',
          'content', coalesce(lesson_payload ->> 'content', '')
        )
      )
      on conflict (lesson_id) do update
      set content_json = excluded.content_json;

    when 'video' then
      if coalesce(lesson_payload ->> 'video_id', '') !~ '^[A-Za-z0-9_-]{11}$' then
        raise exception 'Invalid YouTube video ID' using errcode = '22023';
      end if;

      insert into public.lesson_videos (lesson_id, provider, video_id, duration_seconds)
      values (
        saved_lesson_id,
        'youtube',
        lesson_payload ->> 'video_id',
        nullif(lesson_payload ->> 'duration_seconds', '')::integer
      )
      on conflict (lesson_id) do update
      set
        provider = excluded.provider,
        video_id = excluded.video_id,
        duration_seconds = excluded.duration_seconds;

    when 'assignment' then
      if not (
        coalesce((lesson_payload ->> 'allow_text')::boolean, false)
        or coalesce((lesson_payload ->> 'allow_link')::boolean, false)
        or coalesce((lesson_payload ->> 'allow_file')::boolean, false)
      ) then
        raise exception 'At least one submission method is required' using errcode = '22023';
      end if;

      insert into public.assignments (
        lesson_id,
        instructions,
        allow_text,
        allow_link,
        allow_file,
        allow_resubmission
      )
      values (
        saved_lesson_id,
        coalesce(lesson_payload ->> 'instructions', ''),
        coalesce((lesson_payload ->> 'allow_text')::boolean, false),
        coalesce((lesson_payload ->> 'allow_link')::boolean, false),
        coalesce((lesson_payload ->> 'allow_file')::boolean, false),
        coalesce((lesson_payload ->> 'allow_resubmission')::boolean, false)
      )
      on conflict (lesson_id) do update
      set
        instructions = excluded.instructions,
        allow_text = excluded.allow_text,
        allow_link = excluded.allow_link,
        allow_file = excluded.allow_file,
        allow_resubmission = excluded.allow_resubmission;

    when 'quiz' then
      insert into public.quizzes (lesson_id, max_attempts)
      values (
        saved_lesson_id,
        nullif(lesson_payload ->> 'max_attempts', '')::integer
      )
      on conflict (lesson_id) do update
      set max_attempts = excluded.max_attempts
      returning id into saved_quiz_id;

      delete from public.quiz_questions
      where quiz_questions.quiz_id = saved_quiz_id;

      if jsonb_array_length(coalesce(lesson_payload -> 'questions', '[]'::jsonb)) = 0 then
        raise exception 'Quiz requires at least one question' using errcode = '22023';
      end if;

      for question_row in
        select value, ordinality
        from jsonb_array_elements(lesson_payload -> 'questions') with ordinality
      loop
        if length(btrim(coalesce(question_row.value ->> 'question', ''))) = 0 then
          raise exception 'Question text is required' using errcode = '22023';
        end if;

        question_kind := coalesce(
          question_row.value ->> 'question_type',
          question_row.value ->> 'type'
        )::public.quiz_question_type;
        option_count := jsonb_array_length(coalesce(question_row.value -> 'options', '[]'::jsonb));

        select count(*) into correct_count
        from jsonb_array_elements(coalesce(question_row.value -> 'options', '[]'::jsonb)) option_value
        where coalesce((option_value ->> 'is_correct')::boolean, false);

        if option_count < 2
          or (question_kind in ('single', 'boolean') and correct_count <> 1)
          or (question_kind = 'multiple' and correct_count < 1)
          or (question_kind = 'boolean' and option_count <> 2)
        then
          raise exception 'Invalid quiz answers' using errcode = '22023';
        end if;

        insert into public.quiz_questions (quiz_id, question, question_type, position)
        values (
          saved_quiz_id,
          btrim(question_row.value ->> 'question'),
          question_kind,
          question_row.ordinality
        )
        returning id into saved_question_id;

        for option_row in
          select value, ordinality
          from jsonb_array_elements(question_row.value -> 'options') with ordinality
        loop
          if length(btrim(coalesce(option_row.value ->> 'text', ''))) = 0 then
            raise exception 'Option text is required' using errcode = '22023';
          end if;

          insert into public.quiz_options (question_id, text, is_correct, position)
          values (
            saved_question_id,
            btrim(option_row.value ->> 'text'),
            coalesce((option_row.value ->> 'is_correct')::boolean, false),
            option_row.ordinality
          );
        end loop;
      end loop;
  end case;

  return saved_lesson_id;
end;
$$;

create or replace function public.move_course_lesson(
  target_lesson_id uuid,
  move_direction text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_module_id uuid;
  parent_course_id uuid;
  current_position integer;
  adjacent_lesson_id uuid;
  adjacent_position integer;
begin
  select l.module_id, m.course_id, l.position
  into parent_module_id, parent_course_id, current_position
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = target_lesson_id;

  if parent_course_id is null or not public.is_course_staff(parent_course_id) then
    raise exception 'Lesson access denied' using errcode = '42501';
  end if;

  if move_direction not in ('up', 'down') then
    raise exception 'Invalid direction' using errcode = '22023';
  end if;

  select id, position into adjacent_lesson_id, adjacent_position
  from public.lessons
  where module_id = parent_module_id
    and (
      (move_direction = 'up' and position < current_position)
      or (move_direction = 'down' and position > current_position)
    )
  order by
    case when move_direction = 'up' then position end desc,
    case when move_direction = 'down' then position end asc
  limit 1;

  if adjacent_lesson_id is null then
    return;
  end if;

  set constraints lessons_module_id_position_key deferred;

  update public.lessons
  set position = case
    when id = target_lesson_id then adjacent_position
    when id = adjacent_lesson_id then current_position
  end
  where id in (target_lesson_id, adjacent_lesson_id);
end;
$$;

create or replace function public.delete_course_lesson(target_lesson_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_module_id uuid;
  parent_course_id uuid;
  removed_position integer;
begin
  set constraints lessons_module_id_position_key deferred;

  select l.module_id, m.course_id, l.position
  into parent_module_id, parent_course_id, removed_position
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = target_lesson_id;

  if parent_course_id is null or not public.is_course_staff(parent_course_id) then
    raise exception 'Lesson access denied' using errcode = '42501';
  end if;

  delete from public.lessons where id = target_lesson_id;

  update public.lessons
  set position = position - 1
  where module_id = parent_module_id and position > removed_position;
end;
$$;

create or replace function public.set_course_publication_status(
  target_course_id uuid,
  next_status public.course_status
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_course public.courses;
begin
  if not public.is_course_staff(target_course_id) then
    raise exception 'Course access denied' using errcode = '42501';
  end if;

  select * into target_course
  from public.courses where id = target_course_id;

  if target_course.id is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if next_status = 'published' then
    if length(btrim(target_course.title)) = 0
      or length(btrim(target_course.slug)) = 0
      or length(btrim(coalesce(target_course.description, ''))) = 0
      or not exists (select 1 from public.modules where course_id = target_course_id)
      or not exists (
        select 1
        from public.lessons l
        join public.modules m on m.id = l.module_id
        where m.course_id = target_course_id
      )
    then
      raise exception 'Course is not ready to publish' using errcode = '22023';
    end if;
  end if;

  update public.courses
  set status = next_status
  where id = target_course_id;
end;
$$;

revoke all on function public.create_course_with_relations(
  text, text, text, text, public.course_access_type, numeric, text,
  public.course_level, integer, uuid[], uuid[]
) from public;
revoke all on function public.update_course_with_relations(
  uuid, text, text, text, text, public.course_access_type, numeric, text,
  public.course_level, integer, uuid[], uuid[]
) from public;
revoke all on function public.save_course_module(uuid, uuid, text, text) from public;
revoke all on function public.move_course_module(uuid, text) from public;
revoke all on function public.delete_course_module(uuid) from public;
revoke all on function public.save_course_lesson(
  uuid, uuid, text, text, public.lesson_type, boolean, boolean, jsonb
) from public;
revoke all on function public.move_course_lesson(uuid, text) from public;
revoke all on function public.delete_course_lesson(uuid) from public;
revoke all on function public.set_course_publication_status(uuid, public.course_status) from public;

grant execute on function public.create_course_with_relations(
  text, text, text, text, public.course_access_type, numeric, text,
  public.course_level, integer, uuid[], uuid[]
) to authenticated;
grant execute on function public.update_course_with_relations(
  uuid, text, text, text, text, public.course_access_type, numeric, text,
  public.course_level, integer, uuid[], uuid[]
) to authenticated;
grant execute on function public.save_course_module(uuid, uuid, text, text) to authenticated;
grant execute on function public.move_course_module(uuid, text) to authenticated;
grant execute on function public.delete_course_module(uuid) to authenticated;
grant execute on function public.save_course_lesson(
  uuid, uuid, text, text, public.lesson_type, boolean, boolean, jsonb
) to authenticated;
grant execute on function public.move_course_lesson(uuid, text) to authenticated;
grant execute on function public.delete_course_lesson(uuid) to authenticated;
grant execute on function public.set_course_publication_status(uuid, public.course_status) to authenticated;

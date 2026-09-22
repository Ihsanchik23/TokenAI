alter type public.notification_type add value if not exists 'showcase_rejected';

alter table public.showcase_works
  add constraint showcase_title_length check (length(btrim(title)) between 3 and 120),
  add constraint showcase_description_length check (description is null or length(description) <= 5000),
  add constraint showcase_external_url_length check (external_url is null or length(external_url) <= 2000),
  add constraint showcase_external_url_format check (
    external_url is null or external_url ~* '^https?://[^[:space:]]+$'
  );

create unique index showcase_works_source_submission_unique_idx
on public.showcase_works (source_submission_id)
where source_submission_id is not null;

update storage.buckets
set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'showcase-files';

create or replace function public.can_moderate_showcase(target_work_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.showcase_works work
    join public.assignment_submissions submission on submission.id = work.source_submission_id
    join public.assignments assignment on assignment.id = submission.assignment_id
    join public.lessons lesson on lesson.id = assignment.lesson_id
    join public.modules module on module.id = lesson.module_id
    join public.course_instructors instructor
      on instructor.course_id = module.course_id
      and instructor.user_id = (select auth.uid())
    where work.id = target_work_id
  );
$$;

create or replace function public.protect_showcase_moderation_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and new.user_id = (select auth.uid())
    and not public.can_moderate_showcase(old.id)
    and (
      new.status not in ('draft', 'pending')
      or new.moderation_comment is distinct from old.moderation_comment
      or new.published_at is distinct from old.published_at
    )
  then
    raise exception 'Showcase moderation fields are protected' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger showcase_works_protect_moderation
before update on public.showcase_works
for each row execute function public.protect_showcase_moderation_fields();

drop policy "Published showcase works are publicly readable" on public.showcase_works;
drop policy "Users create own showcase works" on public.showcase_works;
drop policy "Users update own unpublished showcase works" on public.showcase_works;
drop policy "Users delete own unpublished showcase works" on public.showcase_works;
drop policy "Staff moderate showcase works" on public.showcase_works;

create policy "Published owner and authorized staff read showcase works"
on public.showcase_works for select
using (
  status = 'published'
  or user_id = (select auth.uid())
  or public.can_moderate_showcase(id)
);

create policy "Users create own valid showcase works"
on public.showcase_works for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status in ('draft', 'pending')
  and published_at is null
  and moderation_comment is null
  and (cover_path is null or cover_path like (select auth.uid())::text || '/%')
  and (
    source_submission_id is null
    or exists (
      select 1
      from public.assignment_submissions submission
      where submission.id = source_submission_id
        and submission.user_id = (select auth.uid())
        and submission.status = 'approved'
    )
  )
);

create policy "Users update own editable showcase works"
on public.showcase_works for update to authenticated
using (
  user_id = (select auth.uid())
  and status in ('draft', 'pending', 'rejected')
)
with check (
  user_id = (select auth.uid())
  and status in ('draft', 'pending')
  and published_at is null
  and (cover_path is null or cover_path like (select auth.uid())::text || '/%')
  and (
    source_submission_id is null
    or exists (
      select 1
      from public.assignment_submissions submission
      where submission.id = source_submission_id
        and submission.user_id = (select auth.uid())
        and submission.status = 'approved'
    )
  )
);

create policy "Users delete own unpublished showcase works"
on public.showcase_works for delete to authenticated
using (
  user_id = (select auth.uid())
  and status in ('draft', 'pending', 'rejected')
);

create or replace function public.save_showcase_work(
  target_work_id uuid,
  target_topic_id uuid,
  work_title text,
  work_description text,
  work_cover_path text,
  work_external_url text,
  target_source_submission_id uuid,
  submit_for_moderation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_title text := btrim(coalesce(work_title, ''));
  normalized_description text := nullif(btrim(coalesce(work_description, '')), '');
  normalized_cover_path text := nullif(btrim(coalesce(work_cover_path, '')), '');
  normalized_external_url text := nullif(btrim(coalesce(work_external_url, '')), '');
  existing_work public.showcase_works;
  saved_work public.showcase_works;
  stored_size bigint;
  stored_mime text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(normalized_title) not between 3 and 120
    or (normalized_description is not null and length(normalized_description) > 5000)
    or (normalized_external_url is not null and (
      length(normalized_external_url) > 2000
      or normalized_external_url !~* '^https?://[^[:space:]]+$'
    ))
    or not exists (select 1 from public.topics topic where topic.id = target_topic_id)
  then
    raise exception 'Showcase fields are invalid' using errcode = '22023';
  end if;

  if target_source_submission_id is not null and not exists (
    select 1
    from public.assignment_submissions submission
    where submission.id = target_source_submission_id
      and submission.user_id = current_user_id
      and submission.status = 'approved'
  ) then
    raise exception 'Approved assignment submission is required' using errcode = '42501';
  end if;

  if normalized_cover_path is not null then
    if normalized_cover_path like '%..%'
      or normalized_cover_path not like current_user_id::text || '/%'
    then
      raise exception 'Showcase cover path is invalid' using errcode = '22023';
    end if;

    select
      (object.metadata ->> 'size')::bigint,
      object.metadata ->> 'mimetype'
    into stored_size, stored_mime
    from storage.objects object
    where object.bucket_id = 'showcase-files'
      and object.name = normalized_cover_path;

    if stored_size is null
      or stored_size not between 1 and 5242880
      or stored_mime not in ('image/jpeg', 'image/png', 'image/webp')
    then
      raise exception 'Showcase cover is missing or invalid' using errcode = '22023';
    end if;
  end if;

  if target_work_id is not null then
    select work.* into existing_work
    from public.showcase_works work
    where work.id = target_work_id
      and work.user_id = current_user_id
    for update;

    if existing_work.id is null
      or existing_work.status not in ('draft', 'pending', 'rejected')
      or (
        existing_work.source_submission_id is not null
        and existing_work.source_submission_id is distinct from target_source_submission_id
      )
    then
      raise exception 'Showcase work cannot be edited' using errcode = '42501';
    end if;

    update public.showcase_works
    set
      topic_id = target_topic_id,
      source_submission_id = coalesce(existing_work.source_submission_id, target_source_submission_id),
      title = normalized_title,
      description = normalized_description,
      cover_path = normalized_cover_path,
      external_url = normalized_external_url,
      status = case when submit_for_moderation then 'pending'::public.showcase_status else 'draft'::public.showcase_status end
    where id = existing_work.id
    returning * into saved_work;
  else
    insert into public.showcase_works (
      user_id,
      topic_id,
      source_submission_id,
      title,
      description,
      cover_path,
      external_url,
      status
    ) values (
      current_user_id,
      target_topic_id,
      target_source_submission_id,
      normalized_title,
      normalized_description,
      normalized_cover_path,
      normalized_external_url,
      case when submit_for_moderation then 'pending'::public.showcase_status else 'draft'::public.showcase_status end
    )
    returning * into saved_work;
  end if;

  return jsonb_build_object(
    'id', saved_work.id,
    'status', saved_work.status,
    'oldCoverPath', existing_work.cover_path
  );
exception when unique_violation then
  raise exception 'Submission already has a Showcase work' using errcode = '23505';
end;
$$;

create or replace function public.submit_showcase_work(target_work_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_work public.showcase_works;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.showcase_works
  set status = 'pending'
  where id = target_work_id
    and user_id = current_user_id
    and status in ('draft', 'rejected')
  returning * into saved_work;

  if saved_work.id is null then
    raise exception 'Showcase work cannot be submitted' using errcode = '42501';
  end if;

  return jsonb_build_object('id', saved_work.id, 'status', saved_work.status);
end;
$$;

create or replace function public.delete_showcase_work(target_work_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  deleted_cover_path text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.showcase_works
  where id = target_work_id
    and user_id = current_user_id
    and status in ('draft', 'pending', 'rejected')
  returning cover_path into deleted_cover_path;

  if not found then
    raise exception 'Showcase work cannot be deleted' using errcode = '42501';
  end if;

  return deleted_cover_path;
end;
$$;

create or replace function public.moderate_showcase_work(
  target_work_id uuid,
  moderation_decision public.showcase_status,
  reviewer_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_comment text := nullif(btrim(coalesce(reviewer_comment, '')), '');
  target_work public.showcase_works;
begin
  if current_user_id is null or not public.can_moderate_showcase(target_work_id) then
    raise exception 'Showcase moderation access denied' using errcode = '42501';
  end if;

  if moderation_decision not in ('published', 'rejected')
    or (moderation_decision = 'rejected' and normalized_comment is null)
    or (normalized_comment is not null and length(normalized_comment) > 4000)
  then
    raise exception 'Showcase moderation decision is invalid' using errcode = '22023';
  end if;

  select work.* into target_work
  from public.showcase_works work
  where work.id = target_work_id
  for update;

  if target_work.status = moderation_decision then
    return jsonb_build_object('id', target_work.id, 'status', target_work.status, 'reused', true);
  end if;

  if target_work.id is null or target_work.status <> 'pending' then
    raise exception 'Only pending Showcase work can be moderated' using errcode = 'P0001';
  end if;

  update public.showcase_works
  set
    status = moderation_decision,
    moderation_comment = normalized_comment,
    published_at = case when moderation_decision = 'published' then now() else null end
  where id = target_work.id
  returning * into target_work;

  insert into public.notifications (user_id, type, title, message, target_url)
  values (
    target_work.user_id,
    case
      when moderation_decision = 'published' then 'showcase_published'::public.notification_type
      else 'showcase_rejected'::public.notification_type
    end,
    case
      when moderation_decision = 'published' then 'Работа опубликована'
      else 'Работа отклонена'
    end,
    case
      when moderation_decision = 'published' then 'Работа «' || target_work.title || '» появилась в Showcase.'
      else 'Работа «' || target_work.title || '» отклонена модератором.'
    end,
    case
      when moderation_decision = 'published' then '/showcase/' || target_work.id::text
      else '/profile'
    end
  );

  return jsonb_build_object('id', target_work.id, 'status', target_work.status, 'reused', false);
end;
$$;

create or replace function public.list_public_students(
  search_text text default null,
  topic_slug text default null,
  page_number integer default 1,
  page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := lower(btrim(coalesce(search_text, '')));
  normalized_topic text := lower(btrim(coalesce(topic_slug, '')));
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 12), 1), 24);
  total_count integer;
  items jsonb;
begin
  select count(*) into total_count
  from public.profiles profile
  where profile.is_public
    and profile.role = 'student'
    and (
      normalized_search = ''
      or position(normalized_search in lower(coalesce(profile.display_name, ''))) > 0
      or position(normalized_search in lower(profile.username::text)) > 0
    )
    and (
      normalized_topic = ''
      or exists (
        select 1
        from public.profile_topics profile_topic
        join public.topics topic on topic.id = profile_topic.topic_id
        where profile_topic.profile_id = profile.id
          and topic.slug = normalized_topic
      )
    );

  select coalesce(jsonb_agg(item order by item ->> 'displayName', item ->> 'username'), '[]'::jsonb)
  into items
  from (
    select jsonb_build_object(
      'id', profile.id,
      'username', profile.username,
      'displayName', profile.display_name,
      'bio', profile.bio,
      'avatarPath', profile.avatar_path,
      'topics', (
        select coalesce(jsonb_agg(jsonb_build_object('id', topic.id, 'name', topic.name, 'slug', topic.slug) order by topic.name), '[]'::jsonb)
        from public.profile_topics profile_topic
        join public.topics topic on topic.id = profile_topic.topic_id
        where profile_topic.profile_id = profile.id
      ),
      'completedCourseCount', (
        select count(*) from public.enrollments enrollment
        where enrollment.user_id = profile.id and enrollment.status = 'completed'
      ),
      'publishedWorkCount', (
        select count(*) from public.showcase_works work
        where work.user_id = profile.id and work.status = 'published'
      )
    ) as item
    from public.profiles profile
    where profile.is_public
      and profile.role = 'student'
      and (
        normalized_search = ''
        or position(normalized_search in lower(coalesce(profile.display_name, ''))) > 0
        or position(normalized_search in lower(profile.username::text)) > 0
      )
      and (
        normalized_topic = ''
        or exists (
          select 1
          from public.profile_topics profile_topic
          join public.topics topic on topic.id = profile_topic.topic_id
          where profile_topic.profile_id = profile.id
            and topic.slug = normalized_topic
        )
      )
    order by coalesce(profile.display_name, profile.username::text), profile.username
    limit safe_size offset (safe_page - 1) * safe_size
  ) results;

  return jsonb_build_object(
    'items', items,
    'total', total_count,
    'page', safe_page,
    'pageSize', safe_size
  );
end;
$$;

create or replace function public.get_public_student_profile(target_username text)
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
    'id', profile.id,
    'username', profile.username,
    'displayName', profile.display_name,
    'bio', profile.bio,
    'avatarPath', profile.avatar_path,
    'topics', (
      select coalesce(jsonb_agg(jsonb_build_object('id', topic.id, 'name', topic.name, 'slug', topic.slug) order by topic.name), '[]'::jsonb)
      from public.profile_topics profile_topic
      join public.topics topic on topic.id = profile_topic.topic_id
      where profile_topic.profile_id = profile.id
    ),
    'completedCourses', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', course.id,
        'slug', course.slug,
        'title', course.title,
        'status', course.status,
        'completedAt', enrollment.completed_at
      ) order by enrollment.completed_at desc), '[]'::jsonb)
      from public.enrollments enrollment
      join public.courses course on course.id = enrollment.course_id
      where enrollment.user_id = profile.id
        and enrollment.status = 'completed'
    ),
    'certificates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', certificate.id,
        'code', certificate.certificate_code,
        'issuedAt', certificate.issued_at,
        'courseTitle', course.title
      ) order by certificate.issued_at desc), '[]'::jsonb)
      from public.certificates certificate
      join public.enrollments enrollment on enrollment.id = certificate.enrollment_id
      join public.courses course on course.id = enrollment.course_id
      where enrollment.user_id = profile.id
        and enrollment.status = 'completed'
    ),
    'publishedWorks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', work.id,
        'title', work.title,
        'description', work.description,
        'coverPath', work.cover_path,
        'publishedAt', work.published_at,
        'topic', jsonb_build_object('id', topic.id, 'name', topic.name, 'slug', topic.slug)
      ) order by work.published_at desc), '[]'::jsonb)
      from public.showcase_works work
      join public.topics topic on topic.id = work.topic_id
      where work.user_id = profile.id
        and work.status = 'published'
    )
  ) into result
  from public.profiles profile
  where profile.username = lower(btrim(target_username))
    and profile.is_public
    and profile.role = 'student';

  return result;
end;
$$;

create or replace function public.list_published_showcase(
  search_text text default null,
  topic_slug text default null,
  author_username text default null,
  page_number integer default 1,
  page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := lower(btrim(coalesce(search_text, '')));
  normalized_topic text := lower(btrim(coalesce(topic_slug, '')));
  normalized_author text := lower(btrim(coalesce(author_username, '')));
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 12), 1), 24);
  total_count integer;
  items jsonb;
begin
  select count(*) into total_count
  from public.showcase_works work
  join public.topics topic on topic.id = work.topic_id
  join public.profiles profile on profile.id = work.user_id
  where work.status = 'published'
    and (
      normalized_search = ''
      or position(normalized_search in lower(work.title)) > 0
      or position(normalized_search in lower(coalesce(work.description, ''))) > 0
    )
    and (normalized_topic = '' or topic.slug = normalized_topic)
    and (normalized_author = '' or (profile.is_public and profile.username = normalized_author));

  select coalesce(jsonb_agg(item order by published_at desc), '[]'::jsonb)
  into items
  from (
    select
      work.published_at,
      jsonb_build_object(
        'id', work.id,
        'title', work.title,
        'description', work.description,
        'coverPath', work.cover_path,
        'publishedAt', work.published_at,
        'topic', jsonb_build_object('id', topic.id, 'name', topic.name, 'slug', topic.slug),
        'author', case when profile.is_public then jsonb_build_object(
          'displayName', profile.display_name,
          'username', profile.username,
          'avatarPath', profile.avatar_path
        ) else null end,
        'relatedCourse', case when course.id is not null then jsonb_build_object(
          'id', course.id,
          'slug', course.slug,
          'title', course.title,
          'status', course.status
        ) else null end
      ) as item
    from public.showcase_works work
    join public.topics topic on topic.id = work.topic_id
    join public.profiles profile on profile.id = work.user_id
    left join public.assignment_submissions submission on submission.id = work.source_submission_id
    left join public.assignments assignment on assignment.id = submission.assignment_id
    left join public.lessons lesson on lesson.id = assignment.lesson_id
    left join public.modules module on module.id = lesson.module_id
    left join public.courses course on course.id = module.course_id
    where work.status = 'published'
      and (
        normalized_search = ''
        or position(normalized_search in lower(work.title)) > 0
        or position(normalized_search in lower(coalesce(work.description, ''))) > 0
      )
      and (normalized_topic = '' or topic.slug = normalized_topic)
      and (normalized_author = '' or (profile.is_public and profile.username = normalized_author))
    order by work.published_at desc
    limit safe_size offset (safe_page - 1) * safe_size
  ) results;

  return jsonb_build_object(
    'items', items,
    'total', total_count,
    'page', safe_page,
    'pageSize', safe_size
  );
end;
$$;

create or replace function public.get_published_showcase_work(target_work_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', work.id,
    'title', work.title,
    'description', work.description,
    'coverPath', work.cover_path,
    'externalUrl', work.external_url,
    'publishedAt', work.published_at,
    'topic', jsonb_build_object('id', topic.id, 'name', topic.name, 'slug', topic.slug),
    'author', case when profile.is_public then jsonb_build_object(
      'displayName', profile.display_name,
      'username', profile.username,
      'avatarPath', profile.avatar_path
    ) else null end,
    'relatedCourse', case when course.id is not null then jsonb_build_object(
      'id', course.id,
      'slug', course.slug,
      'title', course.title,
      'status', course.status,
      'lessonTitle', lesson.title
    ) else null end
  )
  from public.showcase_works work
  join public.topics topic on topic.id = work.topic_id
  join public.profiles profile on profile.id = work.user_id
  left join public.assignment_submissions submission on submission.id = work.source_submission_id
  left join public.assignments assignment on assignment.id = submission.assignment_id
  left join public.lessons lesson on lesson.id = assignment.lesson_id
  left join public.modules module on module.id = lesson.module_id
  left join public.courses course on course.id = module.course_id
  where work.id = target_work_id
    and work.status = 'published';
$$;

drop policy "Published showcase files are readable" on storage.objects;
drop policy "Users upload own showcase files" on storage.objects;
drop policy "Users manage own showcase files" on storage.objects;
drop policy "Users delete own showcase files" on storage.objects;

create policy "Authorized readers access showcase files"
on storage.objects for select
using (
  bucket_id = 'showcase-files'
  and (
    exists (
      select 1
      from public.showcase_works work
      where work.cover_path = name
        and work.status = 'published'
    )
    or (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.showcase_works work
      where work.cover_path = name
        and public.can_moderate_showcase(work.id)
    )
  )
);

create policy "Users upload own showcase images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'showcase-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (metadata ->> 'mimetype') in ('image/jpeg', 'image/png', 'image/webp')
);

create policy "Users update own unpublished showcase images"
on storage.objects for update to authenticated
using (
  bucket_id = 'showcase-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.showcase_works work
    where work.cover_path = name and work.status = 'published'
  )
)
with check (
  bucket_id = 'showcase-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (metadata ->> 'mimetype') in ('image/jpeg', 'image/png', 'image/webp')
);

create policy "Users delete own unpublished showcase images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'showcase-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.showcase_works work
    where work.cover_path = name and work.status = 'published'
  )
);

revoke all on function public.can_moderate_showcase(uuid) from public;
revoke all on function public.save_showcase_work(uuid, uuid, text, text, text, text, uuid, boolean) from public;
revoke all on function public.submit_showcase_work(uuid) from public;
revoke all on function public.delete_showcase_work(uuid) from public;
revoke all on function public.moderate_showcase_work(uuid, public.showcase_status, text) from public;
revoke all on function public.list_public_students(text, text, integer, integer) from public;
revoke all on function public.get_public_student_profile(text) from public;
revoke all on function public.list_published_showcase(text, text, text, integer, integer) from public;
revoke all on function public.get_published_showcase_work(uuid) from public;

grant execute on function public.can_moderate_showcase(uuid) to anon, authenticated;
grant execute on function public.save_showcase_work(uuid, uuid, text, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.submit_showcase_work(uuid) to authenticated;
grant execute on function public.delete_showcase_work(uuid) to authenticated;
grant execute on function public.moderate_showcase_work(uuid, public.showcase_status, text) to authenticated;
grant execute on function public.list_public_students(text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_public_student_profile(text) to anon, authenticated;
grant execute on function public.list_published_showcase(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_published_showcase_work(uuid) to anon, authenticated;

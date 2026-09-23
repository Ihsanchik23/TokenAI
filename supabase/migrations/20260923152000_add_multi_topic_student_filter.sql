create or replace function public.list_public_students_filtered(
  search_text text default null,
  topic_slugs text[] default '{}'::text[],
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
  normalized_topics text[] := '{}'::text[];
  safe_page integer := greatest(coalesce(page_number, 1), 1);
  safe_size integer := least(greatest(coalesce(page_size, 12), 1), 24);
  total_count integer;
  items jsonb;
begin
  select coalesce(array_agg(distinct lower(btrim(value))), '{}'::text[])
  into normalized_topics
  from unnest(coalesce(topic_slugs, '{}'::text[])) as value
  where btrim(value) <> '';

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
      cardinality(normalized_topics) = 0
      or exists (
        select 1
        from public.profile_topics profile_topic
        join public.topics topic on topic.id = profile_topic.topic_id
        where profile_topic.profile_id = profile.id
          and topic.slug = any(normalized_topics)
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
        cardinality(normalized_topics) = 0
        or exists (
          select 1
          from public.profile_topics profile_topic
          join public.topics topic on topic.id = profile_topic.topic_id
          where profile_topic.profile_id = profile.id
            and topic.slug = any(normalized_topics)
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

revoke all on function public.list_public_students_filtered(text, text[], integer, integer) from public;
grant execute on function public.list_public_students_filtered(text, text[], integer, integer) to anon, authenticated;

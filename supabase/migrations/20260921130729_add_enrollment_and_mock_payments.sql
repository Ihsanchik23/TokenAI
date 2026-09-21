alter table public.orders
add column created_at timestamptz not null default now();

create unique index orders_one_open_or_paid_per_course_idx
on public.orders (user_id, course_id)
where status in ('pending', 'paid');

create unique index payments_one_paid_per_order_idx
on public.payments (order_id)
where status = 'paid';

drop policy "Published courses are publicly readable" on public.courses;
create policy "Published or enrolled courses are readable"
on public.courses for select
using (
  status = 'published'
  or public.is_staff()
  or public.is_enrolled_in_course(id)
);

drop policy "Published course modules are readable" on public.modules;
create policy "Published or enrolled course modules are readable"
on public.modules for select
using (
  public.is_course_staff(course_id)
  or public.is_enrolled_in_course(course_id)
  or exists (
    select 1 from public.courses c
    where c.id = course_id and c.status = 'published'
  )
);

drop policy "Published course lessons are readable" on public.lessons;
create policy "Published or enrolled course lessons are readable"
on public.lessons for select
using (
  exists (
    select 1
    from public.modules m
    join public.courses c on c.id = m.course_id
    where m.id = module_id
      and (
        c.status = 'published'
        or public.is_enrolled_in_course(c.id)
        or public.is_course_staff(c.id)
      )
  )
);

drop policy "Accessible theory is readable" on public.lesson_theory;
create policy "Accessible theory is readable"
on public.lesson_theory for select
using (
  exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lesson_id
      and (
        (c.status = 'published' and l.is_preview)
        or public.is_enrolled_in_course(c.id)
        or public.is_course_staff(c.id)
      )
  )
);

drop policy "Accessible videos are readable" on public.lesson_videos;
create policy "Accessible videos are readable"
on public.lesson_videos for select
using (
  exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lesson_id
      and (
        (c.status = 'published' and l.is_preview)
        or public.is_enrolled_in_course(c.id)
        or public.is_course_staff(c.id)
      )
  )
);

drop policy "Staff manage enrollments" on public.enrollments;
create policy "Admins manage enrollments"
on public.enrollments for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy "Users create own pending orders" on public.orders;

create or replace function public.enroll_in_free_course(target_course_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_course public.courses;
  saved_enrollment public.enrollments;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || target_course_id::text, 0)
  );

  select * into target_course
  from public.courses
  where id = target_course_id
  for update;

  if target_course.id is null
    or target_course.status <> 'published'
    or target_course.access_type <> 'free'
  then
    raise exception 'Course is not available for free enrollment' using errcode = '42501';
  end if;

  select * into saved_enrollment
  from public.enrollments
  where user_id = current_user_id and course_id = target_course_id
  for update;

  if saved_enrollment.id is not null
    and saved_enrollment.status in ('active', 'completed')
    and (saved_enrollment.expires_at is null or saved_enrollment.expires_at > now())
  then
    return saved_enrollment;
  end if;

  insert into public.enrollments (
    user_id, course_id, status, access_source, access_granted_at, expires_at
  )
  values (
    current_user_id, target_course_id, 'active', 'free', now(), null
  )
  on conflict (user_id, course_id) do update
  set
    status = 'active',
    access_source = 'free',
    access_granted_at = now(),
    completed_at = null,
    expires_at = null
  returning * into saved_enrollment;

  return saved_enrollment;
end;
$$;

create or replace function public.create_mock_order(target_course_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_course public.courses;
  existing_enrollment public.enrollments;
  saved_order public.orders;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || target_course_id::text, 0)
  );

  select * into target_course
  from public.courses
  where id = target_course_id
  for update;

  if target_course.id is null
    or target_course.status <> 'published'
    or target_course.access_type <> 'paid'
    or target_course.price_amount is null
    or target_course.price_amount <= 0
    or target_course.currency is null
  then
    raise exception 'Course is not available for purchase' using errcode = '42501';
  end if;

  select * into existing_enrollment
  from public.enrollments
  where user_id = current_user_id and course_id = target_course_id
  for update;

  if existing_enrollment.id is not null
    and existing_enrollment.status in ('active', 'completed')
    and (existing_enrollment.expires_at is null or existing_enrollment.expires_at > now())
  then
    raise exception 'User is already enrolled' using errcode = '23505';
  end if;

  select * into saved_order
  from public.orders
  where user_id = current_user_id
    and course_id = target_course_id
    and status in ('pending', 'paid')
  order by case when status = 'paid' then 0 else 1 end
  limit 1;

  if saved_order.id is null then
    insert into public.orders (user_id, course_id, amount, currency, status)
    values (
      current_user_id,
      target_course_id,
      target_course.price_amount,
      target_course.currency,
      'pending'
    )
    returning * into saved_order;
  end if;

  return saved_order;
end;
$$;

create or replace function public.confirm_mock_payment(target_order_id uuid)
returns table (
  enrollment_id uuid,
  order_id uuid,
  payment_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_enrollment public.enrollments;
  saved_order public.orders;
  saved_payment public.payments;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':' || target_order_id::text, 0)
  );

  select * into saved_order
  from public.orders
  where id = target_order_id and user_id = current_user_id
  for update;

  if saved_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if saved_order.status = 'cancelled' then
    raise exception 'Order is cancelled' using errcode = '22023';
  end if;

  if saved_order.status = 'pending' and not exists (
    select 1 from public.courses
    where id = saved_order.course_id
      and status = 'published'
      and access_type = 'paid'
  )
  then
    raise exception 'Course is not available for purchase' using errcode = '42501';
  end if;

  insert into public.payments (
    order_id, provider, status, external_payment_id, amount, paid_at
  )
  values (
    saved_order.id,
    'mock',
    'paid',
    'mock:' || saved_order.id::text,
    saved_order.amount,
    now()
  )
  on conflict (external_payment_id) do update
  set status = 'paid', amount = excluded.amount, paid_at = coalesce(public.payments.paid_at, now())
  returning * into saved_payment;

  update public.orders
  set status = 'paid'
  where id = saved_order.id
  returning * into saved_order;

  insert into public.enrollments (
    user_id, course_id, status, access_source, access_granted_at, expires_at
  )
  values (
    current_user_id, saved_order.course_id, 'active', 'mock', now(), null
  )
  on conflict (user_id, course_id) do update
  set
    status = 'active',
    access_source = 'mock',
    access_granted_at = now(),
    completed_at = null,
    expires_at = null
  returning * into saved_enrollment;

  return query select saved_enrollment.id, saved_order.id, saved_payment.id;
end;
$$;

create or replace function public.admin_grant_course_access(
  target_user_id uuid,
  target_course_id uuid,
  access_expires_at timestamptz default null
)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_enrollment public.enrollments;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.courses where id = target_course_id) then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if access_expires_at is not null and access_expires_at <= now() then
    raise exception 'Expiry must be in the future' using errcode = '22023';
  end if;

  insert into public.enrollments (
    user_id, course_id, status, access_source, access_granted_at, expires_at
  )
  values (
    target_user_id, target_course_id, 'active', 'admin', now(), access_expires_at
  )
  on conflict (user_id, course_id) do update
  set
    status = 'active',
    access_source = 'admin',
    access_granted_at = now(),
    completed_at = null,
    expires_at = excluded.expires_at
  returning * into saved_enrollment;

  return saved_enrollment;
end;
$$;

create or replace function public.start_my_course(target_course_id uuid)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_enrollment public.enrollments;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.enrollments
  set started_at = coalesce(started_at, now())
  where user_id = current_user_id
    and course_id = target_course_id
    and status in ('active', 'completed')
    and (expires_at is null or expires_at > now())
  returning * into saved_enrollment;

  if saved_enrollment.id is null then
    raise exception 'Active enrollment not found' using errcode = '42501';
  end if;

  return saved_enrollment;
end;
$$;

revoke all on function public.enroll_in_free_course(uuid) from public;
revoke all on function public.create_mock_order(uuid) from public;
revoke all on function public.confirm_mock_payment(uuid) from public;
revoke all on function public.admin_grant_course_access(uuid, uuid, timestamptz) from public;
revoke all on function public.start_my_course(uuid) from public;

grant execute on function public.enroll_in_free_course(uuid) to authenticated;
grant execute on function public.create_mock_order(uuid) to authenticated;
grant execute on function public.confirm_mock_payment(uuid) to authenticated;
grant execute on function public.admin_grant_course_access(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.start_my_course(uuid) to authenticated;

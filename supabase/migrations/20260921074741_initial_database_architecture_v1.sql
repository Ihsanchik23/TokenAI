create extension if not exists citext with schema extensions;

create type public.profile_role as enum ('student', 'instructor', 'admin');
create type public.course_status as enum ('draft', 'published', 'archived');
create type public.course_access_type as enum ('free', 'paid', 'private');
create type public.course_level as enum ('beginner', 'intermediate', 'advanced');
create type public.lesson_type as enum ('theory', 'video', 'quiz', 'assignment');
create type public.quiz_question_type as enum ('single', 'multiple', 'boolean');
create type public.assignment_submission_status as enum ('submitted', 'approved', 'needs_revision');
create type public.enrollment_status as enum ('active', 'completed', 'cancelled');
create type public.enrollment_access_source as enum ('free', 'payment', 'admin', 'mock');
create type public.lesson_progress_status as enum ('available', 'in_progress', 'completed');
create type public.order_status as enum ('pending', 'paid', 'cancelled');
create type public.payment_provider as enum ('mock', 'kaspi', 'future_provider');
create type public.showcase_status as enum ('draft', 'pending', 'published', 'rejected');
create type public.notification_type as enum (
  'assignment_approved',
  'assignment_revision',
  'certificate_issued',
  'showcase_published',
  'course_access_granted'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique,
  display_name text,
  bio text,
  avatar_path text,
  is_public boolean not null default true,
  role public.profile_role not null default 'student',
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (
    username::text ~ '^[a-z0-9_]{3,48}$'
  )
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  constraint topics_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.profile_topics (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete restrict,
  primary key (profile_id, topic_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  cover_path text,
  status public.course_status not null default 'draft',
  access_type public.course_access_type not null default 'private',
  price_amount numeric(12, 2),
  currency text,
  level public.course_level not null default 'beginner',
  estimated_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint courses_price_nonnegative check (price_amount is null or price_amount >= 0),
  constraint courses_currency_format check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint courses_duration_nonnegative check (estimated_minutes is null or estimated_minutes >= 0),
  constraint courses_paid_price check (
    access_type <> 'paid' or (price_amount is not null and price_amount > 0 and currency is not null)
  )
);

create table public.course_instructors (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (course_id, user_id)
);

create table public.course_topics (
  course_id uuid not null references public.courses (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete restrict,
  primary key (course_id, topic_id)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  description text,
  position integer not null,
  unique (course_id, position),
  constraint modules_position_positive check (position > 0)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  description text,
  lesson_type public.lesson_type not null,
  position integer not null,
  is_required boolean not null default true,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, position),
  constraint lessons_position_positive check (position > 0)
);

create table public.lesson_theory (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb
);

create table public.lesson_videos (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  provider text not null default 'youtube_unlisted',
  video_id text not null,
  duration_seconds integer,
  constraint lesson_videos_provider_mvp check (provider = 'youtube_unlisted'),
  constraint lesson_videos_duration_nonnegative check (duration_seconds is null or duration_seconds >= 0)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons (id) on delete cascade,
  max_attempts integer,
  constraint quizzes_max_attempts_positive check (max_attempts is null or max_attempts > 0)
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  question text not null,
  question_type public.quiz_question_type not null,
  position integer not null,
  unique (quiz_id, position),
  constraint quiz_questions_position_positive check (position > 0)
);

create table public.quiz_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position integer not null,
  unique (question_id, position),
  constraint quiz_options_position_positive check (position > 0)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_number integer not null,
  score integer,
  percentage numeric(5, 2),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (quiz_id, user_id, attempt_number),
  constraint quiz_attempts_number_positive check (attempt_number > 0),
  constraint quiz_attempts_score_nonnegative check (score is null or score >= 0),
  constraint quiz_attempts_percentage_range check (percentage is null or percentage between 0 and 100),
  constraint quiz_attempts_completion_order check (completed_at is null or completed_at >= started_at)
);

create table public.quiz_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  option_id uuid not null references public.quiz_options (id) on delete cascade,
  unique (attempt_id, question_id, option_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons (id) on delete cascade,
  instructions text not null,
  allow_text boolean not null default true,
  allow_link boolean not null default false,
  allow_file boolean not null default false,
  allow_resubmission boolean not null default false,
  constraint assignments_submission_method check (allow_text or allow_link or allow_file)
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_number integer not null default 1,
  text_answer text,
  link_url text,
  status public.assignment_submission_status not null default 'submitted',
  teacher_comment text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  unique (assignment_id, user_id, attempt_number),
  constraint assignment_submissions_attempt_positive check (attempt_number > 0),
  constraint assignment_submissions_answer_present check (
    text_answer is not null or link_url is not null
  ),
  constraint assignment_submissions_review_order check (reviewed_at is null or reviewed_at >= submitted_at)
);

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  file_path text not null unique,
  file_name text not null
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status public.enrollment_status not null default 'active',
  access_source public.enrollment_access_source not null,
  access_granted_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  unique (user_id, course_id),
  constraint enrollments_completion_order check (
    completed_at is null or started_at is null or completed_at >= started_at
  ),
  constraint enrollments_expiry_order check (expires_at is null or expires_at >= access_granted_at)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status public.lesson_progress_status not null default 'available',
  progress_percent numeric(5, 2) not null default 0,
  last_video_position integer not null default 0,
  watched_seconds integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (enrollment_id, lesson_id),
  constraint lesson_progress_percentage_range check (progress_percent between 0 and 100),
  constraint lesson_progress_video_position_nonnegative check (last_video_position >= 0),
  constraint lesson_progress_watched_nonnegative check (watched_seconds >= 0),
  constraint lesson_progress_completion_order check (
    completed_at is null or started_at is null or completed_at >= started_at
  )
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  amount numeric(12, 2) not null,
  currency text not null,
  status public.order_status not null default 'pending',
  constraint orders_amount_nonnegative check (amount >= 0),
  constraint orders_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider public.payment_provider not null,
  status text not null,
  external_payment_id text unique,
  amount numeric(12, 2) not null,
  paid_at timestamptz,
  constraint payments_amount_nonnegative check (amount >= 0),
  constraint payments_status_nonempty check (length(btrim(status)) > 0)
);

create table public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null,
  text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id),
  constraint course_reviews_rating_range check (rating between 1 and 5)
);

create table public.showcase_works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete restrict,
  source_submission_id uuid references public.assignment_submissions (id) on delete set null,
  title text not null,
  description text,
  cover_path text,
  external_url text,
  status public.showcase_status not null default 'draft',
  moderation_comment text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint showcase_publication_time check (status <> 'published' or published_at is not null)
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments (id) on delete restrict,
  certificate_code text not null unique,
  issued_at timestamptz not null default now(),
  pdf_path text
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  target_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index profile_topics_topic_id_idx on public.profile_topics (topic_id);
create index course_instructors_user_id_idx on public.course_instructors (user_id);
create index course_topics_topic_id_idx on public.course_topics (topic_id);
create index modules_course_id_idx on public.modules (course_id);
create index lessons_module_id_idx on public.lessons (module_id);
create index quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id);
create index quiz_options_question_id_idx on public.quiz_options (question_id);
create index quiz_attempts_user_id_idx on public.quiz_attempts (user_id);
create index quiz_attempt_answers_attempt_id_idx on public.quiz_attempt_answers (attempt_id);
create index quiz_attempt_answers_question_id_idx on public.quiz_attempt_answers (question_id);
create index quiz_attempt_answers_option_id_idx on public.quiz_attempt_answers (option_id);
create index assignment_submissions_user_id_idx on public.assignment_submissions (user_id);
create index assignment_submissions_reviewer_idx on public.assignment_submissions (reviewed_by);
create index submission_files_submission_id_idx on public.submission_files (submission_id);
create index enrollments_course_id_idx on public.enrollments (course_id);
create index lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);
create index orders_user_id_idx on public.orders (user_id);
create index orders_course_id_idx on public.orders (course_id);
create index payments_order_id_idx on public.payments (order_id);
create index course_reviews_course_id_idx on public.course_reviews (course_id);
create index showcase_works_user_id_idx on public.showcase_works (user_id);
create index showcase_works_topic_id_idx on public.showcase_works (topic_id);
create index showcase_works_status_idx on public.showcase_works (status, published_at desc);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create trigger lesson_progress_set_updated_at
before update on public.lesson_progress
for each row execute function public.set_updated_at();

create trigger course_reviews_set_updated_at
before update on public.course_reviews
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'instructor')
  );
$$;

create or replace function public.is_course_staff(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.course_instructors
    where course_id = target_course_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_enrolled_in_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments
    where course_id = target_course_id
      and user_id = (select auth.uid())
      and status in ('active', 'completed')
      and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.is_course_staff(uuid) from public;
revoke all on function public.is_enrolled_in_course(uuid) from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_course_staff(uuid) to anon, authenticated;
grant execute on function public.is_enrolled_in_course(uuid) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || replace(new.id::text, '-', ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
    and (select auth.uid()) is not null
    and not public.is_admin()
  then
    raise exception 'Only administrators can change profile roles';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.profile_topics enable row level security;
alter table public.courses enable row level security;
alter table public.course_instructors enable row level security;
alter table public.course_topics enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_theory enable row level security;
alter table public.lesson_videos enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.course_reviews enable row level security;
alter table public.showcase_works enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;

create policy "Public profiles are readable"
on public.profiles for select
using (is_public or id = (select auth.uid()) or public.is_staff());

create policy "Users update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Admins update profiles"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Topics are publicly readable"
on public.topics for select
using (true);

create policy "Staff manage topics"
on public.topics for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Profile topics follow profile visibility"
on public.profile_topics for select
using (
  profile_id = (select auth.uid())
  or public.is_staff()
  or exists (
    select 1 from public.profiles p
    where p.id = profile_id and p.is_public
  )
);

create policy "Users manage own profile topics"
on public.profile_topics for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Published courses are publicly readable"
on public.courses for select
using (status = 'published' or public.is_staff());

create policy "Staff create courses"
on public.courses for insert to authenticated
with check (public.is_staff());

create policy "Course staff update courses"
on public.courses for update to authenticated
using (public.is_course_staff(id))
with check (public.is_course_staff(id));

create policy "Course staff delete courses"
on public.courses for delete to authenticated
using (public.is_course_staff(id));

create policy "Published course instructors are readable"
on public.course_instructors for select
using (
  public.is_staff()
  or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
);

create policy "Staff manage course instructors"
on public.course_instructors for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Published course topics are readable"
on public.course_topics for select
using (
  public.is_staff()
  or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
);

create policy "Course staff manage course topics"
on public.course_topics for all to authenticated
using (public.is_course_staff(course_id))
with check (public.is_course_staff(course_id));

create policy "Published course modules are readable"
on public.modules for select
using (
  public.is_course_staff(course_id)
  or exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
);

create policy "Course staff manage modules"
on public.modules for all to authenticated
using (public.is_course_staff(course_id))
with check (public.is_course_staff(course_id));

create policy "Published course lessons are readable"
on public.lessons for select
using (
  exists (
    select 1
    from public.modules m
    join public.courses c on c.id = m.course_id
    where m.id = module_id
      and (c.status = 'published' or public.is_course_staff(c.id))
  )
);

create policy "Course staff manage lessons"
on public.lessons for all to authenticated
using (
  exists (
    select 1 from public.modules m
    where m.id = module_id and public.is_course_staff(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.modules m
    where m.id = module_id and public.is_course_staff(m.course_id)
  )
);

create policy "Accessible theory is readable"
on public.lesson_theory for select
using (
  exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lesson_id
      and c.status = 'published'
      and (l.is_preview or public.is_enrolled_in_course(c.id) or public.is_course_staff(c.id))
  )
);

create policy "Course staff manage theory"
on public.lesson_theory for all to authenticated
using (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
);

create policy "Accessible videos are readable"
on public.lesson_videos for select
using (
  exists (
    select 1
    from public.lessons l
    join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = lesson_id
      and c.status = 'published'
      and (l.is_preview or public.is_enrolled_in_course(c.id) or public.is_course_staff(c.id))
  )
);

create policy "Course staff manage videos"
on public.lesson_videos for all to authenticated
using (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
);

create policy "Accessible quizzes are readable"
on public.quizzes for select to authenticated
using (
  exists (
    select 1
    from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id
      and (public.is_enrolled_in_course(m.course_id) or public.is_course_staff(m.course_id))
  )
);

create policy "Course staff manage quizzes"
on public.quizzes for all to authenticated
using (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
);

create policy "Accessible quiz questions are readable"
on public.quiz_questions for select to authenticated
using (
  exists (
    select 1
    from public.quizzes q
    join public.lessons l on l.id = q.lesson_id
    join public.modules m on m.id = l.module_id
    where q.id = quiz_id
      and (public.is_enrolled_in_course(m.course_id) or public.is_course_staff(m.course_id))
  )
);

create policy "Course staff manage quiz questions"
on public.quiz_questions for all to authenticated
using (
  exists (
    select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id
    join public.modules m on m.id = l.module_id
    where q.id = quiz_id and public.is_course_staff(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id
    join public.modules m on m.id = l.module_id
    where q.id = quiz_id and public.is_course_staff(m.course_id)
  )
);

create policy "Course staff manage quiz options"
on public.quiz_options for all to authenticated
using (
  exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    join public.lessons l on l.id = q.lesson_id join public.modules m on m.id = l.module_id
    where qq.id = question_id and public.is_course_staff(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
    join public.lessons l on l.id = q.lesson_id join public.modules m on m.id = l.module_id
    where qq.id = question_id and public.is_course_staff(m.course_id)
  )
);

create policy "Users read own quiz attempts"
on public.quiz_attempts for select to authenticated
using (user_id = (select auth.uid()) or public.is_staff());

create policy "Users create own quiz attempts"
on public.quiz_attempts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.quizzes q join public.lessons l on l.id = q.lesson_id
    join public.modules m on m.id = l.module_id
    where q.id = quiz_id and public.is_enrolled_in_course(m.course_id)
  )
);

create policy "Staff update quiz attempts"
on public.quiz_attempts for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Users manage answers for own attempts"
on public.quiz_attempt_answers for all to authenticated
using (
  exists (select 1 from public.quiz_attempts qa where qa.id = attempt_id and qa.user_id = (select auth.uid()))
  or public.is_staff()
)
with check (
  exists (select 1 from public.quiz_attempts qa where qa.id = attempt_id and qa.user_id = (select auth.uid()))
  or public.is_staff()
);

create policy "Accessible assignments are readable"
on public.assignments for select to authenticated
using (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id
      and (public.is_enrolled_in_course(m.course_id) or public.is_course_staff(m.course_id))
  )
);

create policy "Course staff manage assignments"
on public.assignments for all to authenticated
using (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
)
with check (
  exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    where l.id = lesson_id and public.is_course_staff(m.course_id)
  )
);

create policy "Users read own assignment submissions"
on public.assignment_submissions for select to authenticated
using (user_id = (select auth.uid()) or public.is_staff());

create policy "Users create own assignment submissions"
on public.assignment_submissions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'submitted'
  and reviewed_at is null
  and reviewed_by is null
  and exists (
    select 1 from public.assignments a join public.lessons l on l.id = a.lesson_id
    join public.modules m on m.id = l.module_id
    where a.id = assignment_id and public.is_enrolled_in_course(m.course_id)
  )
);

create policy "Staff review assignment submissions"
on public.assignment_submissions for update to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Users read files for own submissions"
on public.submission_files for select to authenticated
using (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = submission_id and s.user_id = (select auth.uid())
  )
  or public.is_staff()
);

create policy "Users attach files to own submissions"
on public.submission_files for insert to authenticated
with check (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = submission_id and s.user_id = (select auth.uid())
  )
);

create policy "Users delete files from own submissions"
on public.submission_files for delete to authenticated
using (
  exists (
    select 1 from public.assignment_submissions s
    where s.id = submission_id and s.user_id = (select auth.uid())
  )
  or public.is_staff()
);

create policy "Users read own enrollments"
on public.enrollments for select to authenticated
using (user_id = (select auth.uid()) or public.is_staff());

create policy "Staff manage enrollments"
on public.enrollments for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Users read own lesson progress"
on public.lesson_progress for select to authenticated
using (
  exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.user_id = (select auth.uid())
  )
  or public.is_staff()
);

create policy "Users update own lesson progress"
on public.lesson_progress for update to authenticated
using (
  exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.user_id = (select auth.uid())
  )
);

create policy "Staff manage lesson progress"
on public.lesson_progress for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Users read own orders"
on public.orders for select to authenticated
using (user_id = (select auth.uid()) or public.is_staff());

create policy "Users create own pending orders"
on public.orders for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

create policy "Staff manage orders"
on public.orders for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Users read own payments"
on public.payments for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and o.user_id = (select auth.uid())
  )
  or public.is_staff()
);

create policy "Staff manage payments"
on public.payments for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Published course reviews are readable"
on public.course_reviews for select
using (
  exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')
  or public.is_staff()
);

create policy "Enrolled users create own reviews"
on public.course_reviews for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.enrollments e
    where e.user_id = (select auth.uid())
      and e.course_id = course_id
      and e.status in ('active', 'completed')
  )
);

create policy "Users update own reviews"
on public.course_reviews for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users delete own reviews"
on public.course_reviews for delete to authenticated
using (user_id = (select auth.uid()));

create policy "Published showcase works are publicly readable"
on public.showcase_works for select
using (status = 'published' or user_id = (select auth.uid()) or public.is_staff());

create policy "Users create own showcase works"
on public.showcase_works for insert to authenticated
with check (user_id = (select auth.uid()) and status in ('draft', 'pending'));

create policy "Users update own unpublished showcase works"
on public.showcase_works for update to authenticated
using (user_id = (select auth.uid()) and status <> 'published')
with check (user_id = (select auth.uid()) and status in ('draft', 'pending'));

create policy "Users delete own unpublished showcase works"
on public.showcase_works for delete to authenticated
using (user_id = (select auth.uid()) and status <> 'published');

create policy "Staff moderate showcase works"
on public.showcase_works for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Users read own certificates"
on public.certificates for select to authenticated
using (
  exists (
    select 1 from public.enrollments e
    where e.id = enrollment_id and e.user_id = (select auth.uid())
  )
  or public.is_staff()
);

create policy "Staff manage certificates"
on public.certificates for all to authenticated
using (public.is_staff())
with check (public.is_staff());

create policy "Users read own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or public.is_staff());

create policy "Staff manage notifications"
on public.notifications for all to authenticated
using (public.is_staff())
with check (public.is_staff());

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('course-covers', 'course-covers', true),
  ('submission-files', 'submission-files', false),
  ('showcase-files', 'showcase-files', false),
  ('certificates', 'certificates', false)
on conflict (id) do nothing;

create policy "Public read avatars"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users upload own avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update own avatars"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete own avatars"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);

create policy "Public read course covers"
on storage.objects for select
using (bucket_id = 'course-covers');

create policy "Staff manage course covers"
on storage.objects for all to authenticated
using (bucket_id = 'course-covers' and public.is_staff())
with check (bucket_id = 'course-covers' and public.is_staff());

create policy "Owners and staff read submission files"
on storage.objects for select to authenticated
using (
  bucket_id = 'submission-files'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
);

create policy "Users upload own submission files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submission-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users delete own submission files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'submission-files'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
);

create policy "Published showcase files are readable"
on storage.objects for select
using (
  bucket_id = 'showcase-files'
  and exists (
    select 1 from public.showcase_works sw
    where sw.cover_path = name and sw.status = 'published'
  )
);

create policy "Users upload own showcase files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'showcase-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users manage own showcase files"
on storage.objects for update to authenticated
using (bucket_id = 'showcase-files' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'showcase-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete own showcase files"
on storage.objects for delete to authenticated
using (bucket_id = 'showcase-files' and owner_id = (select auth.uid())::text);

create policy "Certificate owners read files"
on storage.objects for select to authenticated
using (
  bucket_id = 'certificates'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

insert into public.topics (name, slug)
values
  ('AI Video', 'ai-video'),
  ('AI Design', 'ai-design'),
  ('Vibe Coding', 'vibe-coding'),
  ('AI Marketing', 'ai-marketing'),
  ('Automation', 'automation'),
  ('Prompting', 'prompting'),
  ('AI for Business', 'ai-for-business')
on conflict (slug) do update set name = excluded.name;

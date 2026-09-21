# TokenAI Database Architecture v1

## Principles

- Supabase Auth (`auth.users`) is the identity source; `public.profiles.id` is the matching user ID.
- Application primary keys are UUIDs. Junction tables use composite primary keys.
- User-facing tables have Row Level Security enabled. Access is owner-, publication-, enrollment-, or role-scoped.
- `profiles.role` contains `student`, `instructor`, or `admin`. Users cannot promote their own role.
- Database timestamps are stored as `timestamptz` in UTC.
- Course video files are not stored in Supabase Storage. MVP videos use YouTube Unlisted IDs.

## Identity

- `profiles`: public profile data and MVP authorization role. Usernames are unique and case-insensitive.
- `topics`: reusable learning/showcase taxonomy with a unique slug.
- `profile_topics`: many-to-many profile interests.

`profiles.id` references `auth.users.id` with cascade deletion. A trigger creates a profile for each new Auth user.

## Courses and structure

- `courses`: course metadata, lifecycle (`draft`, `published`, `archived`), access type, price, level, and duration.
- `course_instructors`: course-to-instructor assignments.
- `course_topics`: course taxonomy.
- `modules`: ordered sections within a course.
- `lessons`: ordered module content with theory, video, quiz, or assignment type.
- `lesson_theory`: JSON theory content, one row per lesson.
- `lesson_videos`: YouTube Unlisted metadata, one row per lesson.

Deleting a course cascades through its structure. Deleting a topic is restricted while it is referenced.

## Quizzes

- `quizzes`: one quiz configuration per lesson.
- `quiz_questions`: ordered single-, multiple-, or boolean-choice questions.
- `quiz_options`: ordered answer options and correctness metadata.
- `quiz_attempts`: numbered user attempts and results.
- `quiz_attempt_answers`: selected options per attempt and question.

Correct-answer rows are not exposed by a general learner read policy. A later application phase should expose safe quiz payloads through a dedicated function or view.

## Assignments

- `assignments`: one assignment configuration per lesson.
- `assignment_submissions`: numbered learner submissions and review state.
- `submission_files`: metadata for objects in the private `submission-files` bucket.

Submission ownership is tied to the Auth user. Instructor/admin access is role-scoped for the MVP.

## Enrollment and progress

- `enrollments`: unique user/course access with lifecycle and access source.
- `lesson_progress`: unique enrollment/lesson progress record.

Users can read their own enrollments and read/update progress belonging to those enrollments. Staff manage enrollment creation and lifecycle.

## Commerce

- `orders`: course purchase intent and amount.
- `payments`: provider payment events for an order (`mock`, `kaspi`, `future_provider`).

Provider integrations and webhook verification are deferred. Secret keys must remain server-only.

## Community and completion

- `course_reviews`: one review per user/course; creation requires an active or completed enrollment.
- `showcase_works`: moderated public portfolio items, optionally linked to an assignment submission.
- `certificates`: one certificate per enrollment with a globally unique code.
- `notifications`: user-targeted application notifications.

## Storage

| Bucket | Visibility | Write/read intent |
| --- | --- | --- |
| `avatars` | Public | Users manage files under `<user-id>/...` |
| `course-covers` | Public | Public read; instructors/admins write |
| `submission-files` | Private | Owner and instructor/admin access |
| `showcase-files` | Private | Public read only when referenced by a published showcase work |
| `certificates` | Private | Certificate owner read; server-side generation |

Private user-managed buckets use the Auth user ID as the first object-path segment.

## Seed taxonomy

`AI Video`, `AI Design`, `Vibe Coding`, `AI Marketing`, `Automation`, `Prompting`, and `AI for Business` are inserted idempotently by the initial migration.

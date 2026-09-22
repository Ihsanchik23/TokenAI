import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { completeTheoryLessonAction } from "@/app/learning/actions";
import { AssignmentLesson } from "@/components/assignment-lesson";
import { LessonStart } from "@/components/lesson-start";
import { LearningNavigation } from "@/components/learning-navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { QuizLesson } from "@/components/quiz-lesson";
import { YouTubeLearningPlayer } from "@/components/youtube-learning-player";
import { requireUser } from "@/lib/auth";
import type { AssignmentLessonData } from "@/lib/assignments";
import { getLearningState } from "@/lib/learning";
import type { QuizLessonData } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/server";

export default async function LearningLessonPage({ params, searchParams }: { params: Promise<{ courseSlug: string; lessonId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ courseSlug, lessonId }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  const state = await getLearningState(courseSlug, user.id);
  if (!state) notFound();
  const lessonIndex = state.lessons.findIndex((item) => item.id === lessonId);
  if (lessonIndex < 0) notFound();
  const lesson = state.lessons[lessonIndex];
  if (lesson.state === "locked") redirect(`/learn/${courseSlug}`);
  const previous = state.lessons[lessonIndex - 1];
  const next = state.lessons[lessonIndex + 1];
  const currentModule = state.modules.find((item) => item.id === lesson.moduleId);
  const supabase = await createClient();
  let content: React.ReactNode;

  if (lesson.lesson_type === "theory") {
    const { data } = await supabase.from("lesson_theory").select("content_json").eq("lesson_id", lesson.id).maybeSingle();
    content = <MarkdownContent value={(data?.content_json as { content?: string } | null)?.content ?? ""} />;
  } else if (lesson.lesson_type === "video") {
    const { data } = await supabase.from("lesson_videos").select("video_id").eq("lesson_id", lesson.id).maybeSingle();
    content = data?.video_id
      ? state.enrollment
        ? <YouTubeLearningPlayer lessonId={lesson.id} videoId={data.video_id} savedPosition={lesson.lastVideoPosition} />
        : <div className="video-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${data.video_id}`} title={lesson.title} allowFullScreen /></div>
      : <p className="notice">Видео для урока не настроено.</p>;
  } else if (lesson.lesson_type === "quiz") {
    if (!state.enrollment) {
      content = <p className="notice">Staff preview не создаёт студенческие попытки теста.</p>;
    } else {
      const { data, error } = await supabase.rpc("get_quiz_lesson", { target_lesson_id: lesson.id });
      content = error || !data
        ? <p className="notice">Не удалось загрузить тест. Обновите страницу или обратитесь к администратору.</p>
        : <QuizLesson lessonId={lesson.id} data={data as QuizLessonData} />;
    }
  } else {
    if (!state.enrollment) {
      content = <p className="notice">Staff preview не создаёт студенческие отправки задания.</p>;
    } else {
      const { data, error } = await supabase.rpc("get_assignment_lesson", { target_lesson_id: lesson.id });
      if (error || !data) {
        content = <p className="notice">Не удалось загрузить задание. Обновите страницу или обратитесь к администратору.</p>;
      } else {
        const assignment = data as AssignmentLessonData;
        assignment.submissions = await Promise.all(assignment.submissions.map(async (submission) => ({
          ...submission,
          files: await Promise.all(submission.files.map(async (file) => {
            const { data: signed } = await supabase.storage.from("submission-files").createSignedUrl(file.path, 3600);
            return { ...file, signedUrl: signed?.signedUrl ?? null };
          })),
        })));
        content = <AssignmentLesson userId={user.id} data={assignment} />;
      }
    }
  }

  const lessonLabels = { theory: "Теория", video: "Видео", quiz: "Тест", assignment: "Задание" } as const;

  return (
    <main className="page-shell learning-shell">
      <LearningNavigation courseSlug={courseSlug} courseTitle={state.course.title} currentLessonId={lesson.id} modules={state.modules} progressPercent={state.progressPercent} progressLabel={`${state.completedRequired} из ${state.requiredTotal} обязательных`} />
      <article className={`learning-content lesson-${lesson.lesson_type}`}>
        {state.enrollment && lesson.state !== "completed" && <LessonStart lessonId={lesson.id} />}
        <header className="lesson-heading">
          <p className="lesson-context">{currentModule ? `Модуль ${currentModule.position} · ${currentModule.title}` : state.course.title}</p>
          <div className="lesson-labels"><span>{lessonLabels[lesson.lesson_type]}</span><span>{lesson.is_required ? "Обязательный урок" : "Дополнительный урок"}</span></div>
          <h1>{lesson.title}</h1>
          {lesson.description && <p className="hero-text">{lesson.description}</p>}
        </header>
        {query.error === "complete-failed" && <p className="notice">Не удалось завершить урок. Обновите страницу и попробуйте ещё раз.</p>}
        <section className="lesson-stage">{content}</section>
        <div className="lesson-completion-action">
          {lesson.lesson_type === "theory" && state.enrollment && lesson.state !== "completed" && <form action={completeTheoryLessonAction.bind(null, courseSlug, lesson.id)}><button className="button"><CheckCircle2 aria-hidden="true" size={18} />Отметить урок завершённым</button></form>}
          {lesson.state === "completed" && <p className="completed-state"><CheckCircle2 aria-hidden="true" size={20} /><span><strong>Урок завершён</strong><small>Прогресс сохранён</small></span></p>}
        </div>
        <nav className="lesson-navigation" aria-label="Навигация между уроками">
          <div>{previous && previous.state !== "locked" && <Link className="lesson-nav-link previous" href={`/learn/${courseSlug}/${previous.id}`}><ArrowLeft aria-hidden="true" size={18} /><span><small>Предыдущий</small>{previous.title}</span></Link>}</div>
          <div>{next && next.state !== "locked" ? <Link className="lesson-nav-link next" href={`/learn/${courseSlug}/${next.id}`}><span><small>Следующий</small>{next.title}</span><ArrowRight aria-hidden="true" size={18} /></Link> : next ? <span className="lesson-nav-locked"><LockKeyhole aria-hidden="true" size={17} />Следующий урок пока закрыт</span> : state.curriculumComplete ? <Link className="button" href={`/learn/${courseSlug}/complete`}>Итоги курса<ArrowRight aria-hidden="true" size={18} /></Link> : null}</div>
        </nav>
      </article>
    </main>
  );
}

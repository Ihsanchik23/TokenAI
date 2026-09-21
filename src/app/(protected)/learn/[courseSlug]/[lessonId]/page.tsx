import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { completeTheoryLessonAction } from "@/app/learning/actions";
import { LessonStart } from "@/components/lesson-start";
import { MarkdownContent } from "@/components/markdown-content";
import { QuizLesson } from "@/components/quiz-lesson";
import { YouTubeLearningPlayer } from "@/components/youtube-learning-player";
import { requireUser } from "@/lib/auth";
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
    content = <div className="notice"><strong>Assignment Engine появится в следующей фазе.</strong><p>Этот обязательный урок нельзя отметить выполненным вручную, поэтому дальнейшая последовательность останется заблокированной.</p></div>;
  }

  return <main className="page-shell learning-shell"><aside className="learning-sidebar stack"><Link href="/my-courses">← Мои курсы</Link><div><p className="eyebrow">{state.progressPercent}%</p><h2>{state.course.title}</h2><div className="progress-track"><span style={{ width: `${state.progressPercent}%` }} /></div><p className="field-help">{state.completedRequired} из {state.requiredTotal} обязательных</p></div>{state.modules.map((courseModule) => <section className="stack compact" key={courseModule.id}><strong>{courseModule.position}. {courseModule.title}</strong>{courseModule.lessons.map((item) => item.state === "locked" ? <span className="curriculum-link locked" key={item.id}>🔒 {item.title}</span> : <Link className={`curriculum-link ${item.id === lesson.id ? "current" : ""}`} href={`/learn/${courseSlug}/${item.id}`} key={item.id}>{item.state === "completed" ? "✓" : "○"} {item.title}</Link>)}</section>)}</aside><article className="learning-content stack roomy">{state.enrollment && lesson.state !== "completed" && <LessonStart lessonId={lesson.id} />}<header className="stack compact"><p className="eyebrow">{lesson.lesson_type} · {lesson.is_required ? "обязательный" : "необязательный"}</p><h1>{lesson.title}</h1>{lesson.description && <p className="hero-text">{lesson.description}</p>}</header>{query.error === "complete-failed" && <p className="notice">Не удалось завершить урок. Обновите страницу и попробуйте ещё раз.</p>}<section className="card">{content}</section>{lesson.lesson_type === "theory" && state.enrollment && lesson.state !== "completed" && <form action={completeTheoryLessonAction.bind(null, courseSlug, lesson.id)}><button className="button">Отметить урок завершённым</button></form>}{lesson.state === "completed" && <p className="notice success">Урок завершён.</p>}<nav className="lesson-navigation"><div>{previous && previous.state !== "locked" && <Link className="button secondary" href={`/learn/${courseSlug}/${previous.id}`}>← Предыдущий</Link>}</div><div>{next && next.state !== "locked" ? <Link className="button" href={`/learn/${courseSlug}/${next.id}`}>Следующий →</Link> : next ? <span className="muted">Следующий урок пока закрыт</span> : state.learningComplete ? <Link className="button" href={`/learn/${courseSlug}/complete`}>Итоги курса</Link> : null}</div></nav></article></main>;
}

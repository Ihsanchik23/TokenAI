import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LessonEditor } from "@/components/lesson-editor";
import { getAdminCourse } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";

export default async function EditLessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params; const data = await getAdminCourse(id); const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("id,module_id,title,description,lesson_type,is_required,is_preview").eq("id", lessonId).maybeSingle();
  if (!lesson || !data.modules.some((module) => module.id === lesson.module_id)) notFound();
  const initial: Record<string, unknown> = { id: lesson.id, moduleId: lesson.module_id, title: lesson.title, description: lesson.description, lessonType: lesson.lesson_type, isRequired: lesson.is_required, isPreview: lesson.is_preview };
  if (lesson.lesson_type === "theory") { const { data: row } = await supabase.from("lesson_theory").select("content_json").eq("lesson_id", lessonId).maybeSingle(); initial.content = (row?.content_json as { content?: string } | null)?.content ?? ""; }
  if (lesson.lesson_type === "video") { const { data: row } = await supabase.from("lesson_videos").select("video_id,duration_seconds").eq("lesson_id", lessonId).maybeSingle(); initial.videoId = row?.video_id; initial.durationSeconds = row?.duration_seconds; }
  if (lesson.lesson_type === "assignment") { const { data: row } = await supabase.from("assignments").select("instructions,allow_text,allow_link,allow_file,allow_resubmission").eq("lesson_id", lessonId).maybeSingle(); Object.assign(initial, { instructions: row?.instructions, allowText: row?.allow_text, allowLink: row?.allow_link, allowFile: row?.allow_file, allowResubmission: row?.allow_resubmission }); }
  if (lesson.lesson_type === "quiz") { const { data: quiz } = await supabase.from("quizzes").select("id,max_attempts,quiz_questions(question,question_type,position,quiz_options(text,is_correct,position))").eq("lesson_id", lessonId).maybeSingle(); initial.maxAttempts = quiz?.max_attempts; initial.questions = (quiz?.quiz_questions ?? []).sort((a, b) => a.position - b.position).map((q) => ({ question: q.question, question_type: q.question_type, options: q.quiz_options.sort((a, b) => a.position - b.position).map((o) => ({ text: o.text, is_correct: o.is_correct })) })); }
  return <section className="studio-page lesson-editor-page"><Link className="studio-back-link" href={`/admin/courses/${id}/edit#course-program`}><ArrowLeft aria-hidden="true" size={17} />{data.course.title}</Link><header className="studio-page-heading"><div><p className="eyebrow">Программа курса</p><h1>Редактировать урок</h1><p>Измените содержание, обязательность или доступность preview.</p></div></header><LessonEditor courseId={id} modules={data.modules} initial={initial as never} /></section>;
}

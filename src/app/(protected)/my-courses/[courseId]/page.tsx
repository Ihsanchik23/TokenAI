import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseCurriculum } from "@/components/course-curriculum";
import { requireUser } from "@/lib/auth";
import { getEnrollment } from "@/lib/enrollments";
import { createClient } from "@/lib/supabase/server";

export default async function CoursePlayerPlaceholder({ params }: { params: Promise<{ courseId: string }> }) {
  const [{ courseId }, user] = await Promise.all([params, requireUser()]);
  const enrollment = await getEnrollment(user.id, courseId);
  if (!enrollment) notFound();
  const supabase = await createClient();
  const [{ data: course }, { data: modules }] = await Promise.all([
    supabase.from("courses").select("id,title,description,status").eq("id", courseId).maybeSingle(),
    supabase.from("modules").select("id,title,description,position,lessons(id,title,lesson_type,position,is_preview)").eq("course_id", courseId).order("position").order("position", { referencedTable: "lessons" }),
  ]);
  if (!course) notFound();

  return <main className="page-shell stack roomy"><Link href="/my-courses">← Мои курсы</Link><header className="stack compact"><p className="eyebrow">{course.status === "archived" ? "Архив · доступ сохранён" : "Курс"}</p><h1>{course.title}</h1><p className="hero-text">{course.description}</p><p className="notice success">Course player будет расширен в следующей фазе. Ваш доступ уже проверяется сервером.</p></header><CourseCurriculum modules={(modules ?? []) as never} /></main>;
}

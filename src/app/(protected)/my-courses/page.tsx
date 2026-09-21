import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startCourseAction } from "@/app/enrollment/actions";
import { requireUser } from "@/lib/auth";
import { getCourseCoverUrl } from "@/lib/course-utils";
import { ensureMyProfile, getMyProfile, isProfileComplete } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const statusLabels: Record<string, string> = { active: "Активный", completed: "Завершён", cancelled: "Отменён" };

export default async function MyCoursesPage({ searchParams }: { searchParams: Promise<{ payment?: string; course?: string }> }) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const supabase = await createClient();
  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, user.id);
  if (!profile || !isProfileComplete(profile)) redirect("/onboarding");

  const { data: rows } = await supabase.from("enrollments").select("id,course_id,status,access_source,access_granted_at,started_at,completed_at,expires_at").eq("user_id", user.id).in("status", ["active", "completed"]).order("access_granted_at", { ascending: false });
  const enrollments = (rows ?? []).filter((row) => !row.expires_at || new Date(row.expires_at) > new Date());
  const courseIds = enrollments.map((row) => row.course_id);
  const [{ data: courses }, { data: progressRows }, { data: modules }] = courseIds.length ? await Promise.all([
    supabase.from("courses").select("id,slug,title,cover_path,access_type,status").in("id", courseIds),
    supabase.from("lesson_progress").select("enrollment_id,progress_percent").in("enrollment_id", enrollments.map((row) => row.id)),
    supabase.from("modules").select("course_id,lessons(id)").in("course_id", courseIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const courseById = new Map((courses ?? []).map((course) => [course.id, course]));
  const lessonCountByCourse = new Map<string, number>();
  for (const courseModule of modules ?? []) lessonCountByCourse.set(courseModule.course_id, (lessonCountByCourse.get(courseModule.course_id) ?? 0) + courseModule.lessons.length);

  return <main className="page-shell stack roomy"><header className="stack compact"><p className="eyebrow">Обучение</p><h1>Мои курсы</h1><p className="muted">Все курсы, к которым у вас есть активный доступ.</p></header>{query.payment === "success" && <p className="notice success">Mock-оплата подтверждена. Курс добавлен.</p>}{query.course === "unavailable" && <p className="notice">Доступ к курсу недоступен или истёк.</p>}<div className="course-grid">{enrollments.length ? enrollments.map((enrollment) => { const course = courseById.get(enrollment.course_id); if (!course) return null; const cover = getCourseCoverUrl(course.cover_path); const progress = (progressRows ?? []).filter((row) => row.enrollment_id === enrollment.id); const average = progress.length ? Math.round(progress.reduce((sum, row) => sum + Number(row.progress_percent), 0) / Math.max(lessonCountByCourse.get(course.id) ?? progress.length, 1)) : 0; return <article className="course-card" key={enrollment.id}>{cover ? <Image src={cover} alt="" width={640} height={360} /> : <div className="cover-placeholder">TokenAI</div>}<div className="card-body stack"><div className="actions split"><span className={`badge ${enrollment.status}`}>{statusLabels[enrollment.status]}</span><span className="muted">{enrollment.access_source}</span></div><h2>{course.title}</h2><p className="muted">{course.access_type} · {course.status === "archived" ? "курс в архиве, доступ сохранён" : course.status}</p><div><strong>Прогресс: {average}%</strong><div className="progress-track"><span style={{ width: `${average}%` }} /></div></div>{enrollment.started_at ? <Link className="button" href={`/my-courses/${course.id}`}>Продолжить</Link> : <form action={startCourseAction.bind(null, course.id)}><button className="button">Начать</button></form>}</div></article>; }) : <section className="card stack center"><h2>Курсов пока нет</h2><p className="muted">Выберите бесплатный или платный курс в каталоге.</p><Link className="button" href="/courses">Открыть каталог</Link></section>}</div></main>;
}

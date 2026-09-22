import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startCourseAction } from "@/app/enrollment/actions";
import { CertificateCard } from "@/components/certificate-card";
import { requireUser } from "@/lib/auth";
import { evaluateCourseCompletion, getCertificateDownloadUrl, type CourseCompletion } from "@/lib/certificates";
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
  const enrollments = (rows ?? []).filter((row) => row.status === "completed" || !row.expires_at || new Date(row.expires_at) > new Date());
  const courseIds = enrollments.map((row) => row.course_id);
  const [{ data: courses }, { data: certificateRows }, completionRows] = courseIds.length ? await Promise.all([
    supabase.from("courses").select("id,slug,title,cover_path,access_type,status").in("id", courseIds),
    supabase.from("certificates").select("id,enrollment_id,certificate_code,issued_at,pdf_path").in("enrollment_id", enrollments.map((row) => row.id)),
    Promise.all(enrollments.map((enrollment) => evaluateCourseCompletion(supabase, enrollment.id))),
  ]) : [{ data: [] }, { data: [] }, [] as (CourseCompletion | null)[]];
  const courseById = new Map((courses ?? []).map((course) => [course.id, course]));
  const completionByEnrollment = new Map(enrollments.map((enrollment, index) => [enrollment.id, completionRows[index]]));
  const certificateByEnrollment = new Map(await Promise.all((certificateRows ?? []).map(async (certificate) => [certificate.enrollment_id, {
    ...certificate,
    downloadUrl: await getCertificateDownloadUrl(supabase, certificate.pdf_path),
  }] as const)));

  return (
    <main className="page-shell stack roomy">
      <header className="stack compact"><p className="eyebrow">Обучение</p><h1>Мои курсы</h1><p className="muted">Все курсы, к которым у вас есть активный доступ.</p></header>
      {query.payment === "success" && <p className="notice success">Mock-оплата подтверждена. Курс добавлен.</p>}
      {query.course === "unavailable" && <p className="notice">Доступ к курсу недоступен или истёк.</p>}
      <div className="course-grid">
        {enrollments.length ? enrollments.map((enrollment) => {
          const course = courseById.get(enrollment.course_id);
          if (!course) return null;
          const completion = completionByEnrollment.get(enrollment.id);
          const certificate = certificateByEnrollment.get(enrollment.id);
          const progress = completion?.progressPercent ?? 0;
          const cover = getCourseCoverUrl(course.cover_path);
          return <article className="course-card" key={enrollment.id}>{cover ? <Image src={cover} alt="" width={640} height={360} /> : <div className="cover-placeholder">TokenAI</div>}<div className="card-body stack"><div className="actions split"><span className={`badge ${completion?.status ?? enrollment.status}`}>{statusLabels[completion?.status ?? enrollment.status]}</span><span className="muted">{enrollment.access_source}</span></div><h2>{course.title}</h2><p className="muted">{course.access_type} · {course.status === "archived" ? "курс в архиве, доступ сохранён" : course.status}</p><div><strong>Прогресс: {progress}%</strong><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><small className="field-help">{completion?.completedRequired ?? 0} из {completion?.requiredTotal ?? 0} обязательных уроков</small></div>{completion?.missingAssignments ? <p className="notice">Ожидают одобрения задания: {completion.missingAssignments}</p> : null}{enrollment.started_at ? <Link className="button" href={`/learn/${course.slug}`}>{completion?.fullyCompleted ? "Итоги и сертификат" : "Продолжить"}</Link> : <form action={startCourseAction.bind(null, course.id)}><button className="button">Начать</button></form>}{certificate && <CertificateCard certificate={{ ...certificate, courseTitle: course.title }} />}</div></article>;
        }) : <section className="card stack center"><h2>Курсов пока нет</h2><p className="muted">Выберите бесплатный или платный курс в каталоге.</p><Link className="button" href="/courses">Открыть каталог</Link></section>}
      </div>
    </main>
  );
}

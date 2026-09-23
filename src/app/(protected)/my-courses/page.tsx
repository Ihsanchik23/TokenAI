import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Award, BookOpen, CheckCircle2 } from "lucide-react";
import { startCourseAction } from "@/app/enrollment/actions";
import { CertificateCard } from "@/components/certificate-card";
import { requireUser } from "@/lib/auth";
import { getCertificateDownloadUrl } from "@/lib/certificates";
import { getCourseCoverUrl } from "@/lib/course-utils";
import { getLearningState } from "@/lib/learning";
import { ensureMyProfile, getMyProfile, isProfileComplete } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function MyCoursesPage({ searchParams }: { searchParams: Promise<{ payment?: string; course?: string }> }) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const supabase = await createClient();
  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, user.id);
  if (!profile || !isProfileComplete(profile)) redirect("/onboarding");

  const { data: rows } = await supabase.from("enrollments").select("id,course_id,status,access_source,access_granted_at,started_at,completed_at,expires_at").eq("user_id", user.id).in("status", ["active", "completed"]).order("access_granted_at", { ascending: false });
  const enrollments = (rows ?? []).filter((row) => row.status === "completed" || !row.expires_at || new Date(row.expires_at) > new Date());
  const courseIds = enrollments.map((row) => row.course_id);
  const [{ data: courses }, { data: certificateRows }] = courseIds.length ? await Promise.all([
    supabase.from("courses").select("id,slug,title,cover_path,access_type,status").in("id", courseIds),
    supabase.from("certificates").select("id,enrollment_id,certificate_code,issued_at,pdf_path").in("enrollment_id", enrollments.map((row) => row.id)),
  ]) : [{ data: [] }, { data: [] }];
  const courseById = new Map((courses ?? []).map((course) => [course.id, course]));
  const learningEntries = await Promise.all(enrollments.map(async (enrollment) => {
    const course = courseById.get(enrollment.course_id);
    return [enrollment.id, course ? await getLearningState(course.slug, user.id) : null] as const;
  }));
  const learningByEnrollment = new Map(learningEntries);
  const certificateByEnrollment = new Map(await Promise.all((certificateRows ?? []).map(async (certificate) => [certificate.enrollment_id, {
    ...certificate,
    downloadUrl: await getCertificateDownloadUrl(supabase, certificate.pdf_path),
  }] as const)));
  const activeEnrollments = enrollments.filter((enrollment) => enrollment.status !== "completed" && !learningByEnrollment.get(enrollment.id)?.learningComplete);
  const completedEnrollments = enrollments.filter((enrollment) => enrollment.status === "completed" || learningByEnrollment.get(enrollment.id)?.learningComplete);
  const primary = activeEnrollments.find((enrollment) => enrollment.started_at) ?? activeEnrollments[0] ?? null;

  function compactCourse(enrollment: typeof enrollments[number]) {
    const course = courseById.get(enrollment.course_id);
    if (!course) return null;
    const state = learningByEnrollment.get(enrollment.id);
    const certificate = certificateByEnrollment.get(enrollment.id);
    const completed = enrollment.status === "completed" || Boolean(state?.learningComplete);
    const progress = state?.progressPercent ?? (completed ? 100 : 0);
    const cover = getCourseCoverUrl(course.cover_path);
    return (
      <article className="my-course-row" key={enrollment.id}>
        <div className="my-course-thumb">{cover ? <Image src={cover} alt="" fill sizes="(max-width: 700px) 112px, 180px" /> : <div className="cover-placeholder">T</div>}</div>
        <div className="my-course-copy">
          <div className="my-course-status">{completed ? <><CheckCircle2 aria-hidden="true" size={15} />Завершён</> : <><BookOpen aria-hidden="true" size={15} />В процессе</>}</div>
          <h3>{course.title}</h3>
          {state?.continueLesson && <p className="muted">Далее: {state.continueLesson.title}</p>}
          <div className="continue-progress"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>
        </div>
        <div className="my-course-actions">
          {enrollment.started_at ? <Link className="button secondary" href={`/learn/${course.slug}`}>{completed ? "Открыть итоги" : "Продолжить"}<ArrowRight aria-hidden="true" size={17} /></Link> : <form action={startCourseAction.bind(null, course.id)}><button className="button secondary">Начать</button></form>}
          {certificate?.downloadUrl && <a className="certificate-link" href={certificate.downloadUrl} target="_blank" rel="noreferrer"><Award aria-hidden="true" size={17} />Сертификат</a>}
        </div>
      </article>
    );
  }

  return (
    <main className="page-shell my-courses-page">
      <header className="my-courses-heading"><p className="eyebrow">Обучение</p><h1>Мои курсы</h1><p className="hero-text">Продолжайте текущий курс или вернитесь к завершённым программам.</p></header>
      {query.payment === "success" && <p className="notice success">Покупка подтверждена. Курс добавлен в «Мои курсы» — нажмите «Начать курс», когда будете готовы.</p>}
      {query.course === "unavailable" && <p className="notice">Доступ к курсу недоступен или истёк.</p>}
      {primary ? (() => {
        const course = courseById.get(primary.course_id);
        const state = learningByEnrollment.get(primary.id);
        if (!course) return null;
        const cover = getCourseCoverUrl(course.cover_path);
        return <section className="primary-learning" aria-labelledby="primary-learning-heading"><div className="primary-learning-media">{cover ? <Image src={cover} alt={`Обложка курса «${course.title}»`} fill sizes="(max-width: 800px) 100vw, 48vw" priority /> : <div className="cover-placeholder">TokenAI</div>}</div><div className="primary-learning-copy"><p className="eyebrow">Продолжить обучение</p><h2 id="primary-learning-heading">{course.title}</h2>{state?.continueLesson && <div className="current-lesson"><span>{state.continueLesson.modulePosition}.{state.continueLesson.position}</span><div><small>Текущий урок</small><strong>{state.continueLesson.title}</strong></div></div>}<div className="primary-progress"><div className="split"><span>Прогресс курса</span><strong>{state?.progressPercent ?? 0}%</strong></div><div className="progress-track"><span style={{ width: `${state?.progressPercent ?? 0}%` }} /></div><small>{state?.completedRequired ?? 0} из {state?.requiredTotal ?? 0} обязательных уроков</small></div>{state?.completion?.missingAssignments ? <p className="notice">На проверке заданий: {state.completion.missingAssignments}</p> : null}{primary.started_at ? <Link className="button" href={`/learn/${course.slug}`}>Продолжить<ArrowRight aria-hidden="true" size={18} /></Link> : <form action={startCourseAction.bind(null, course.id)}><button className="button">Начать курс<ArrowRight aria-hidden="true" size={18} /></button></form>}</div></section>;
      })() : null}

      {enrollments.length ? <div className="my-course-sections"><nav className="learning-tabs" aria-label="Разделы моих курсов"><a href="#active">Активные <span>{activeEnrollments.length}</span></a><a href="#completed">Завершённые <span>{completedEnrollments.length}</span></a></nav><section id="active" className="my-course-section"><div className="section-heading-inline"><h2>Активные</h2><span>{activeEnrollments.length}</span></div><div className="my-course-list">{activeEnrollments.filter((item) => item.id !== primary?.id).length ? activeEnrollments.filter((item) => item.id !== primary?.id).map(compactCourse) : <p className="empty-section-copy">{primary ? "Основной активный курс показан выше." : "Активных курсов сейчас нет."}</p>}</div></section><section id="completed" className="my-course-section"><div className="section-heading-inline"><h2>Завершённые</h2><span>{completedEnrollments.length}</span></div><div className="my-course-list">{completedEnrollments.length ? completedEnrollments.map(compactCourse) : <p className="empty-section-copy">Завершённые курсы появятся здесь.</p>}</div>{completedEnrollments.map((enrollment) => { const certificate = certificateByEnrollment.get(enrollment.id); const course = courseById.get(enrollment.course_id); return certificate && course && !certificate.downloadUrl ? <CertificateCard certificate={{ ...certificate, courseTitle: course.title }} key={certificate.id} /> : null; })}</section></div> : <section className="empty-state my-courses-empty"><div className="empty-state-mark" aria-hidden="true">0</div><h2>У вас пока нет курсов</h2><p className="muted">Выберите программу в каталоге — она появится здесь после зачисления.</p><Link className="button" href="/courses">Открыть каталог</Link></section>}
    </main>
  );
}

import Link from "next/link";
import { ArrowUpRight, Award, BarChart3, BookOpen, CheckCircle2, ClipboardCheck, Star, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type PlatformMetrics = {
  totalUsers: number; publicProfiles: number; privateProfiles: number; publishedCourses: number;
  totalEnrollments: number; activeEnrollments: number; completedEnrollments: number;
  certificatesIssued: number; publishedShowcaseWorks: number;
};
type ModuleMetric = { id: string; title: string; position: number; reachedStudents: number; completedStudents: number };
type CourseMetric = {
  id: string; slug: string; title: string; status: string; enrollments: number; activeEnrollments: number;
  startedStudents: number; completedStudents: number; completionRate: number; averageProgress: number;
  averageQuizPercentage: number | null; assignmentSubmittedCount: number; assignmentApprovedCount: number;
  averageRating: number | null; reviewCount: number; modules: ModuleMetric[];
};
type Analytics = { platform: PlatformMetrics | null; courses: CourseMetric[] };

const platformLabels: Array<[keyof PlatformMetrics, string, typeof UsersRound]> = [
  ["totalUsers", "Пользователи", UsersRound], ["publishedCourses", "Опубликованные курсы", BookOpen],
  ["totalEnrollments", "Все записи", BarChart3], ["completedEnrollments", "Завершения", CheckCircle2],
  ["certificatesIssued", "Сертификаты", Award], ["publishedShowcaseWorks", "Работы Showcase", Star],
];

function percent(value: number | null) {
  return value === null ? "—" : `${Number(value).toFixed(1)}%`;
}

function courseStatus(value: string) {
  return ({ draft: "Черновик", published: "Опубликован", archived: "В архиве" } as Record<string, string>)[value] ?? value;
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_analytics");
  if (error) return <section className="studio-page"><div className="studio-empty"><BarChart3 aria-hidden="true" size={28} /><h1>Аналитика недоступна</h1><p>Не удалось загрузить агрегированные показатели.</p></div></section>;
  const analytics = data as Analytics;

  return (
    <section className="studio-page analytics-page">
      <header className="studio-page-heading"><div><p className="eyebrow">Метрики</p><h1>Аналитика</h1><p>Агрегированные данные без персональной информации студентов.</p></div></header>
      {analytics.platform && <section className="platform-metrics" aria-label="Показатели платформы">{platformLabels.map(([key, label, Icon]) => <article key={key}><span><Icon aria-hidden="true" size={18} />{label}</span><strong>{analytics.platform![key]}</strong></article>)}<div className="platform-profile-split"><span>Профили</span><strong>{analytics.platform.publicProfiles} публичных</strong><small>{analytics.platform.privateProfiles} приватных</small></div><div className="platform-profile-split"><span>Активные записи</span><strong>{analytics.platform.activeEnrollments}</strong><small>из {analytics.platform.totalEnrollments}</small></div></section>}
      <section className="course-analytics-section"><div className="studio-section-heading"><div><p className="eyebrow">Курсы</p><h2>Показатели обучения</h2></div><span>{analytics.courses.length}</span></div>{analytics.courses.length ? <div className="course-analytics-list">{analytics.courses.map((course) => <article className="course-analytics-item" key={course.id}><header><div><span className={`studio-status ${course.status}`}>{courseStatus(course.status)}</span><h3>{course.title}</h3></div><Link href={`/courses/${course.slug}`}>Открыть курс<ArrowUpRight aria-hidden="true" size={16} /></Link></header><div className="course-kpi-grid"><div><strong>{course.enrollments}</strong><span>Записей</span></div><div><strong>{course.startedStudents}</strong><span>Начали</span></div><div><strong>{course.completedStudents}</strong><span>Завершили</span></div><div><strong>{percent(course.averageQuizPercentage)}</strong><span>Средний тест</span></div><div><strong>{course.assignmentSubmittedCount}</strong><span>Заданий</span></div><div><strong>{course.averageRating === null ? "—" : course.averageRating.toFixed(1)}</strong><span>Рейтинг · {course.reviewCount}</span></div></div><div className="course-progress-pair"><div><span><strong>Completion rate</strong><b>{percent(course.completionRate)}</b></span><div className="analytics-bar"><i style={{ width: `${Math.min(100, Math.max(0, course.completionRate))}%` }} /></div></div><div><span><strong>Средний прогресс</strong><b>{percent(course.averageProgress)}</b></span><div className="analytics-bar"><i style={{ width: `${Math.min(100, Math.max(0, course.averageProgress))}%` }} /></div></div></div><div className="module-funnel"><h4>Прохождение модулей</h4>{course.modules.length ? course.modules.map((module) => { const reached = course.enrollments ? module.reachedStudents / course.enrollments * 100 : 0; const completed = course.enrollments ? module.completedStudents / course.enrollments * 100 : 0; return <div className="module-funnel-row" key={module.id}><span><b>{module.position}</b><strong>{module.title}</strong></span><div><i style={{ width: `${Math.min(100, reached)}%` }} /><i style={{ width: `${Math.min(100, completed)}%` }} /></div><small>дошли {module.reachedStudents} · завершили {module.completedStudents}</small></div>; }) : <p className="studio-empty-inline">Модулей пока нет.</p>}</div><footer><span><ClipboardCheck aria-hidden="true" size={16} />Принято заданий: {course.assignmentApprovedCount}</span><span>Активных записей: {course.activeEnrollments}</span></footer></article>)}</div> : <div className="studio-empty"><BarChart3 aria-hidden="true" size={28} /><h2>Нет данных по курсам</h2><p>Показатели появятся после создания доступного вам курса.</p></div>}</section>
    </section>
  );
}

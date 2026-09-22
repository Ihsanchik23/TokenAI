import Link from "next/link";
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

const platformLabels: Array<[keyof PlatformMetrics, string]> = [
  ["totalUsers", "Пользователи"], ["publicProfiles", "Публичные профили"], ["privateProfiles", "Приватные профили"],
  ["publishedCourses", "Опубликованные курсы"], ["totalEnrollments", "Все записи"], ["activeEnrollments", "Активные записи"],
  ["completedEnrollments", "Завершённые записи"], ["certificatesIssued", "Сертификаты"], ["publishedShowcaseWorks", "Работы Showcase"],
];

function percent(value: number | null) {
  return value === null ? "—" : `${Number(value).toFixed(1)}%`;
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_staff_analytics");
  if (error) return <section className="card"><p className="notice">Не удалось загрузить аналитику.</p></section>;
  const analytics = data as Analytics;

  return (
    <section className="stack roomy">
      <div><p className="eyebrow">Метрики</p><h2>Аналитика</h2><p className="muted">Агрегированные данные без персональной информации студентов.</p></div>
      {analytics.platform && <div className="analytics-grid">{platformLabels.map(([key, label]) => <article className="card metric-card" key={key}><strong>{analytics.platform![key]}</strong><span className="muted">{label}</span></article>)}</div>}
      <div className="stack">{analytics.courses.length ? analytics.courses.map((course) => <article className="card stack" key={course.id}><header className="split"><div><p className="eyebrow">{course.status}</p><h3>{course.title}</h3></div><Link href={`/courses/${course.slug}`}>Открыть курс</Link></header><div className="analytics-grid compact"><div><strong>{course.enrollments}</strong><span> записей</span></div><div><strong>{course.startedStudents}</strong><span> начали</span></div><div><strong>{course.completedStudents}</strong><span> завершили</span></div><div><strong>{percent(course.completionRate)}</strong><span> completion rate</span></div><div><strong>{percent(course.averageProgress)}</strong><span> средний прогресс</span></div><div><strong>{percent(course.averageQuizPercentage)}</strong><span> средний quiz</span></div><div><strong>{course.assignmentSubmittedCount}</strong><span> заданий отправлено</span></div><div><strong>{course.assignmentApprovedCount}</strong><span> заданий принято</span></div><div><strong>{course.averageRating === null ? "—" : `${course.averageRating}/5`}</strong><span> · {course.reviewCount} отзывов</span></div></div><div className="stack compact"><h4>Прохождение модулей</h4>{course.modules.length ? course.modules.map((module) => <div className="module-metric" key={module.id}><span>{module.position}. {module.title}</span><span className="muted">дошли {module.reachedStudents} · завершили {module.completedStudents}</span></div>) : <p className="field-help">Модулей пока нет.</p>}</div></article>) : <div className="card center"><p className="muted">Доступных курсов пока нет.</p></div>}</div>
    </section>
  );
}

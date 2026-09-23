import Image from "next/image";
import Link from "next/link";
import { Clock3, Gauge, Star } from "lucide-react";
import { CatalogCourseAction } from "@/components/catalog-course-action";
import { CatalogFilters } from "@/components/catalog-filters";
import { getOptionalUser } from "@/lib/auth";
import { formatCoursePrice, getCourseCoverUrl } from "@/lib/course-utils";
import { createClient } from "@/lib/supabase/server";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; level?: string; access?: string; topic?: string; sort?: string }> }) {
  const [filters, user] = await Promise.all([searchParams, getOptionalUser()]);
  const supabase = await createClient();
  const { data: topics } = await supabase.from("topics").select("id,name,slug").order("name");
  let ids: string[] | null = null;
  if (filters.topic) { const topic = topics?.find((item) => item.slug === filters.topic); if (topic) { const { data } = await supabase.from("course_topics").select("course_id").eq("topic_id", topic.id); ids = (data ?? []).map((row) => row.course_id); } }
  let query = supabase.from("courses").select("id,slug,title,short_description,cover_path,access_type,price_amount,currency,level,estimated_minutes,created_at").eq("status", "published");
  if (filters.q?.trim()) query = query.ilike("title", `%${filters.q.trim()}%`);
  if (["beginner", "intermediate", "advanced"].includes(filters.level ?? "")) query = query.eq("level", filters.level!);
  if (["free", "paid", "private"].includes(filters.access ?? "")) query = query.eq("access_type", filters.access!);
  if (ids) query = ids.length ? query.in("id", ids) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  query = filters.sort === "title" ? query.order("title") : query.order("created_at", { ascending: false });
  const { data: courses, error: coursesError } = await query;
  const courseIds = (courses ?? []).map((course) => course.id);
  const { data: enrollmentRows } = user && courseIds.length
    ? await supabase.from("enrollments").select("course_id,status,expires_at").eq("user_id", user.id).in("course_id", courseIds).in("status", ["active", "completed"])
    : { data: [] };
  const enrolledCourseIds = new Set((enrollmentRows ?? []).filter((row) => !row.expires_at || new Date(row.expires_at) > new Date()).map((row) => row.course_id));
  const catalogError = coursesError;
  const reviewEntries = await Promise.all((courses ?? []).map(async (course) => {
    const { data } = await supabase.rpc("get_public_course_reviews", { target_course_id: course.id, result_limit: 1 });
    const summary = data as { averageRating?: number | null; reviewCount?: number } | null;
    return [course.id, { average: summary?.averageRating ?? null, count: summary?.reviewCount ?? 0 }] as const;
  }));
  const reviews = new Map(reviewEntries);
  const levelLabels: Record<string, string> = { beginner: "Начальный", intermediate: "Средний", advanced: "Продвинутый" };

  return (
    <main className="page-shell catalog-page">
      <header className="catalog-heading"><p className="eyebrow">Каталог TokenAI</p><h1>Курсы</h1></header>
      <CatalogFilters key={[filters.q, filters.topic, filters.level, filters.access, filters.sort].join("|")} topics={topics ?? []} filters={filters} />
      <div className="catalog-results-heading"><p className="muted">{catalogError ? "Не удалось загрузить каталог" : courses?.length ? `Найдено курсов: ${courses.length}` : "По выбранным условиям ничего не найдено"}</p></div>
      <section className="learning-course-grid" aria-label="Список курсов">
        {!catalogError && courses?.length ? courses.map((course) => {
          const cover = getCourseCoverUrl(course.cover_path);
          const review = reviews.get(course.id);
          return (
            <article className="learning-course-card" key={course.id}>
              <Link className="course-card-cover" href={`/courses/${course.slug}`} aria-label={`Открыть курс «${course.title}»`}>
                {cover ? <Image src={cover} alt="" fill sizes="(max-width: 700px) 100vw, 50vw" /> : <div className="cover-placeholder">TokenAI</div>}
              </Link>
              <div className="course-card-content">
                <h2><Link href={`/courses/${course.slug}`}>{course.title}</Link></h2>
                <p className="muted course-card-description">{course.short_description || "Описание скоро появится."}</p>
                <div className="course-card-facts">
                  <span><Gauge aria-hidden="true" size={15} />{levelLabels[course.level]}</span>
                  {review && review.count > 0 && <span><Star aria-hidden="true" size={15} fill="currentColor" />{review.average}</span>}
                  {course.estimated_minutes && <span><Clock3 aria-hidden="true" size={15} />{course.estimated_minutes} мин</span>}
                </div>
                <div className="course-card-footer">
                  <strong>{formatCoursePrice(course.access_type, course.price_amount, course.currency)}</strong>
                  <CatalogCourseAction courseId={course.id} slug={course.slug} accessType={course.access_type} authenticated={Boolean(user)} enrolled={enrolledCourseIds.has(course.id)} />
                </div>
              </div>
            </article>
          );
        }) : catalogError ? (
          <div className="empty-state"><div className="empty-state-mark" aria-hidden="true">!</div><h2>Каталог временно недоступен</h2><p className="muted">Не удалось получить курсы. Попробуйте обновить страницу.</p></div>
        ) : (
          <div className="empty-state"><div className="empty-state-mark" aria-hidden="true">0</div><h2>Курсы не найдены</h2><p className="muted">Сбросьте часть фильтров или попробуйте другой поисковый запрос.</p><Link className="button secondary" href="/courses">Сбросить фильтры</Link></div>
        )}
      </section>
    </main>
  );
}

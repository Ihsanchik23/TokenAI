import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3, Star } from "lucide-react";
import { CatalogFilters } from "@/components/catalog-filters";
import { formatCoursePrice, getCourseCoverUrl } from "@/lib/course-utils";
import { createClient } from "@/lib/supabase/server";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; level?: string; access?: string; topic?: string; sort?: string }> }) {
  const filters = await searchParams;
  const supabase = await createClient();
  const { data: topics } = await supabase.from("topics").select("id,name,slug").order("name");
  let ids: string[] | null = null;
  if (filters.topic) { const topic = topics?.find((item) => item.slug === filters.topic); if (topic) { const { data } = await supabase.from("course_topics").select("course_id").eq("topic_id", topic.id); ids = (data ?? []).map((row) => row.course_id); } }
  let query = supabase.from("courses").select("id,slug,title,short_description,cover_path,access_type,price_amount,currency,level,estimated_minutes,created_at,course_topics(topics(name,slug)),course_instructors(profiles(display_name,username))").eq("status", "published");
  if (filters.q?.trim()) query = query.ilike("title", `%${filters.q.trim()}%`);
  if (["beginner", "intermediate", "advanced"].includes(filters.level ?? "")) query = query.eq("level", filters.level!);
  if (["free", "paid", "private"].includes(filters.access ?? "")) query = query.eq("access_type", filters.access!);
  if (ids) query = ids.length ? query.in("id", ids) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  query = filters.sort === "title" ? query.order("title") : query.order("created_at", { ascending: false });
  const { data: courses } = await query;
  const reviewEntries = await Promise.all((courses ?? []).map(async (course) => {
    const { data } = await supabase.rpc("get_public_course_reviews", { target_course_id: course.id, result_limit: 1 });
    const summary = data as { averageRating?: number | null; reviewCount?: number } | null;
    return [course.id, { average: summary?.averageRating ?? null, count: summary?.reviewCount ?? 0 }] as const;
  }));
  const reviews = new Map(reviewEntries);
  const levelLabels: Record<string, string> = { beginner: "Начальный", intermediate: "Средний", advanced: "Продвинутый" };

  return (
    <main className="page-shell catalog-page">
      <header className="catalog-heading"><p className="eyebrow">Каталог TokenAI</p><h1>Курсы для практики<br />с AI‑инструментами</h1><p className="hero-text">Выберите направление и двигайтесь от первого урока к готовому результату.</p></header>
      <CatalogFilters topics={topics ?? []} filters={filters} />
      <div className="catalog-results-heading"><p className="muted">{courses?.length ? `Найдено курсов: ${courses.length}` : "По выбранным условиям ничего не найдено"}</p></div>
      <section className="learning-course-grid" aria-label="Список курсов">
        {courses?.length ? courses.map((course) => {
          const cover = getCourseCoverUrl(course.cover_path);
          const review = reviews.get(course.id);
          const instructor = course.course_instructors.map((row) => row.profiles[0]?.display_name || (row.profiles[0]?.username ? `@${row.profiles[0].username}` : null)).filter(Boolean).join(", ");
          return (
            <article className="learning-course-card" key={course.id}>
              <Link className="course-card-cover" href={`/courses/${course.slug}`} aria-label={`Открыть курс «${course.title}»`}>
                {cover ? <Image src={cover} alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" /> : <div className="cover-placeholder">TokenAI</div>}
                <span className="course-card-arrow"><ArrowUpRight aria-hidden="true" size={19} /></span>
              </Link>
              <div className="course-card-content">
                <div className="course-card-kicker"><span>{course.course_topics[0]?.topics[0]?.name ?? levelLabels[course.level]}</span><span>{levelLabels[course.level]}</span></div>
                <h2><Link href={`/courses/${course.slug}`}>{course.title}</Link></h2>
                {instructor && <p className="course-instructor">{instructor}</p>}
                <p className="muted course-card-description">{course.short_description || "Описание скоро появится."}</p>
                <div className="course-card-footer">
                  <strong>{formatCoursePrice(course.access_type, course.price_amount, course.currency)}</strong>
                  <div className="course-card-facts">
                    {review && review.count > 0 && <span><Star aria-hidden="true" size={15} fill="currentColor" />{review.average} ({review.count})</span>}
                    {course.estimated_minutes && <span><Clock3 aria-hidden="true" size={15} />{course.estimated_minutes} мин</span>}
                  </div>
                </div>
              </div>
            </article>
          );
        }) : (
          <div className="empty-state"><div className="empty-state-mark" aria-hidden="true">0</div><h2>Курсы не найдены</h2><p className="muted">Сбросьте часть фильтров или попробуйте другой поисковый запрос.</p><Link className="button secondary" href="/courses">Сбросить фильтры</Link></div>
        )}
      </section>
    </main>
  );
}

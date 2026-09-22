import Image from "next/image";
import { Clock3, Gauge, Star, UserRound } from "lucide-react";
import { CourseCta } from "@/components/course-cta";
import { CourseCurriculum } from "@/components/course-curriculum";
import { CourseReviewForm } from "@/components/course-review-form";
import { getOptionalUser } from "@/lib/auth";
import { formatCoursePrice, getCourseCoverUrl } from "@/lib/course-utils";
import { getPublicCourse } from "@/lib/courses";
import { getEnrollment } from "@/lib/enrollments";
import { createClient } from "@/lib/supabase/server";

type PublicReview = {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  displayName: string | null;
  username: string | null;
};

type ReviewSummary = { averageRating: number | null; reviewCount: number; reviews: PublicReview[] };
type ReviewState = { enrolled: boolean; eligible: boolean; progressPercentage: number; review: { rating: number; text: string | null } | null };

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, user] = await Promise.all([getPublicCourse(slug), getOptionalUser()]);
  const supabase = await createClient();
  const [enrollment, reviewResult, reviewStateResult] = await Promise.all([
    user ? getEnrollment(user.id, data.course.id) : null,
    supabase.rpc("get_public_course_reviews", { target_course_id: data.course.id, result_limit: 30 }),
    user ? supabase.rpc("get_my_course_review_state", { target_course_id: data.course.id }) : Promise.resolve({ data: null }),
  ]);
  const reviewSummary = (reviewResult.data ?? { averageRating: null, reviewCount: 0, reviews: [] }) as ReviewSummary;
  const reviewState = reviewStateResult.data as ReviewState | null;
  const cover = getCourseCoverUrl(data.course.cover_path);

  return (
    <main className="course-detail-page">
      <header className="course-detail-hero page-shell">
        <div className="course-detail-media">{cover ? <Image src={cover} alt={`Обложка курса «${data.course.title}»`} fill sizes="(max-width: 900px) 100vw, 52vw" priority /> : <div className="cover-placeholder">TokenAI</div>}</div>
        <div className="course-detail-copy">
          <div className="tag-list">{data.topics.map((row) => row.topics[0] && <span className="tag" key={row.topics[0].slug}>{row.topics[0].name}</span>)}</div>
          <h1>{data.course.title}</h1>
          <p className="hero-text">{data.course.short_description || data.course.description}</p>
          <div className="course-facts">
            <span><Gauge aria-hidden="true" size={17} />{({ beginner: "Начальный", intermediate: "Средний", advanced: "Продвинутый" } as const)[data.course.level]}</span>
            {data.course.estimated_minutes && <span><Clock3 aria-hidden="true" size={17} />{data.course.estimated_minutes} мин</span>}
            {reviewSummary.reviewCount > 0 && <span><Star aria-hidden="true" size={17} fill="currentColor" />{reviewSummary.averageRating} · {reviewSummary.reviewCount}</span>}
          </div>
          <p className="course-instructors"><UserRound aria-hidden="true" size={18} />{data.instructors.map((row) => row.profiles[0]?.display_name || `@${row.profiles[0]?.username}`).join(", ") || "Команда TokenAI"}</p>
          <div className="course-purchase-row"><strong>{formatCoursePrice(data.course.access_type, data.course.price_amount, data.course.currency)}</strong><CourseCta courseId={data.course.id} slug={slug} accessType={data.course.access_type} authenticated={Boolean(user)} enrolled={Boolean(enrollment)} /></div>
        </div>
      </header>

      <div className="course-detail-body page-shell">
        <section className="course-overview-section" aria-labelledby="outcomes-heading">
          <div className="course-section-heading"><p className="eyebrow">Результат</p><h2 id="outcomes-heading">Что вы изучите</h2></div>
          <ol className="course-outcomes">{data.modules.map((module) => <li key={module.id}><span>{String(module.position).padStart(2, "0")}</span><strong>{module.title}</strong>{module.description && <p>{module.description}</p>}</li>)}</ol>
        </section>

        {data.course.description && <section className="course-description-section"><div className="course-section-heading"><p className="eyebrow">О курсе</p><h2>Описание</h2></div><div className="lesson-content"><p>{data.course.description}</p></div></section>}

        <section className="course-program-section" aria-labelledby="program-heading"><div className="course-section-heading"><p className="eyebrow">Программа</p><h2 id="program-heading">Содержание курса</h2></div><CourseCurriculum modules={data.modules as never} slug={slug} /></section>

        <section className="course-instructor-section" aria-labelledby="instructor-heading"><div className="course-section-heading"><p className="eyebrow">Преподаватели</p><h2 id="instructor-heading">Авторы курса</h2></div><div className="instructor-list">{data.instructors.length ? data.instructors.map((row) => row.profiles[0] && <div className="instructor-item" key={row.profiles[0].id}><span className="instructor-avatar" aria-hidden="true">{(row.profiles[0].display_name || row.profiles[0].username).charAt(0).toUpperCase()}</span><div><strong>{row.profiles[0].display_name || `@${row.profiles[0].username}`}</strong>{row.profiles[0].display_name && <p className="muted">@{row.profiles[0].username}</p>}</div></div>) : <p className="muted">Команда TokenAI</p>}</div></section>

        <section className="course-reviews-section" aria-labelledby="reviews-heading">
          <div className="course-section-heading"><p className="eyebrow">Отзывы</p><h2 id="reviews-heading">{reviewSummary.reviewCount ? `${reviewSummary.averageRating} из 5 · ${reviewSummary.reviewCount}` : "Отзывов пока нет"}</h2><p className="muted">Оценки оставляют студенты, прошедшие не менее половины курса.</p></div>
          {user && reviewState?.eligible && <CourseReviewForm courseId={data.course.id} slug={slug} existing={reviewState.review} />}
          {user && reviewState?.enrolled && !reviewState.eligible && <p className="notice">Пройдите не менее 50% курса, чтобы оставить отзыв. Сейчас: {reviewState.progressPercentage}%.</p>}
          <div className="review-list">{reviewSummary.reviews.length ? reviewSummary.reviews.map((review) => <article className="review-item" key={review.id}><div><span className="review-stars" aria-label={`${review.rating} из 5`}>{Array.from({ length: 5 }, (_, index) => <Star aria-hidden="true" size={15} fill={index < review.rating ? "currentColor" : "none"} key={index} />)}</span><span className="field-help">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</span></div><p>{review.text || "Оценка без комментария"}</p><p className="field-help">{review.displayName || (review.username ? `@${review.username}` : "Участник TokenAI")}</p></article>) : <div className="empty-inline"><Star aria-hidden="true" size={22} /><p>Станьте первым, кто поделится впечатлением после прохождения курса.</p></div>}</div>
        </section>
      </div>
    </main>
  );
}

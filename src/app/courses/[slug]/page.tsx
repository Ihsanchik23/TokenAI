import Image from "next/image";
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
    <main className="page-shell stack roomy">
      <header className="course-hero">
        {cover ? <Image src={cover} alt="" width={720} height={405} priority /> : <div className="cover-placeholder">TokenAI</div>}
        <div className="stack">
          <div className="tag-list">{data.topics.map((row) => row.topics[0] && <span className="tag" key={row.topics[0].slug}>{row.topics[0].name}</span>)}</div>
          <h1>{data.course.title}</h1>
          <p className="hero-text">{data.course.description || data.course.short_description}</p>
          <div className="actions"><strong>{formatCoursePrice(data.course.access_type, data.course.price_amount, data.course.currency)}</strong><span className="muted">{data.course.level}{data.course.estimated_minutes ? ` · ${data.course.estimated_minutes} мин` : ""}</span></div>
          <p className="muted">Преподаватели: {data.instructors.map((row) => row.profiles[0]?.display_name || `@${row.profiles[0]?.username}`).join(", ") || "команда TokenAI"}</p>
          <CourseCta courseId={data.course.id} slug={slug} accessType={data.course.access_type} authenticated={Boolean(user)} enrolled={Boolean(enrollment)} />
        </div>
      </header>
      <section className="stack"><div><p className="eyebrow">Программа</p><h2>Содержание курса</h2></div><CourseCurriculum modules={data.modules as never} slug={slug} /></section>
      <section className="stack roomy">
        <div><p className="eyebrow">Отзывы</p><h2>{reviewSummary.reviewCount ? `${reviewSummary.averageRating} из 5 · ${reviewSummary.reviewCount}` : "Отзывов пока нет"}</h2><p className="muted">Оценки оставляют студенты, прошедшие не менее половины курса.</p></div>
        {user && reviewState?.eligible && <CourseReviewForm courseId={data.course.id} slug={slug} existing={reviewState.review} />}
        {user && reviewState?.enrolled && !reviewState.eligible && <p className="notice">Пройдите не менее 50% курса, чтобы оставить отзыв. Сейчас: {reviewState.progressPercentage}%.</p>}
        <div className="stack">{reviewSummary.reviews.length ? reviewSummary.reviews.map((review) => <article className="card stack compact" key={review.id}><div className="split"><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong><span className="field-help">{new Date(review.createdAt).toLocaleDateString("ru-RU")}</span></div><p>{review.text || "Оценка без комментария"}</p><p className="field-help">{review.displayName || (review.username ? `@${review.username}` : "Участник TokenAI")}</p></article>) : <div className="card center"><p className="muted">Станьте первым, кто поделится впечатлением после прохождения курса.</p></div>}</div>
      </section>
    </main>
  );
}

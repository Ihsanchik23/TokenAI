import Image from "next/image";
import { CourseCta } from "@/components/course-cta";
import { CourseCurriculum } from "@/components/course-curriculum";
import { getOptionalUser } from "@/lib/auth";
import { formatCoursePrice, getCourseCoverUrl } from "@/lib/course-utils";
import { getPublicCourse } from "@/lib/courses";
import { getEnrollment } from "@/lib/enrollments";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, user] = await Promise.all([getPublicCourse(slug), getOptionalUser()]);
  const enrollment = user ? await getEnrollment(user.id, data.course.id) : null;
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
    </main>
  );
}

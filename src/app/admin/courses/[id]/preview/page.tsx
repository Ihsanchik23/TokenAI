import Image from "next/image";
import { CourseCurriculum } from "@/components/course-curriculum";
import { getCourseCoverUrl, formatCoursePrice } from "@/lib/course-utils";
import { getAdminCourse } from "@/lib/courses";

export default async function StaffPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { course, modules } = await getAdminCourse(id); const cover = getCourseCoverUrl(course.cover_path);
  return <section className="stack roomy"><div className="notice">Staff preview: этот экран доступен только команде курса.</div><header className="course-hero">{cover && <Image src={cover} alt="" width={720} height={405} />}<div className="stack"><p className="eyebrow">{course.status} · {formatCoursePrice(course.access_type, course.price_amount, course.currency)}</p><h1>{course.title}</h1><p className="hero-text">{course.description || course.short_description || "Описание ещё не заполнено."}</p></div></header><CourseCurriculum modules={modules as never} admin courseId={id} /></section>;
}

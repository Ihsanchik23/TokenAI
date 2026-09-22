import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, Pencil } from "lucide-react";
import { CourseCurriculum } from "@/components/course-curriculum";
import { getCourseCoverUrl, formatCoursePrice } from "@/lib/course-utils";
import { getAdminCourse } from "@/lib/courses";

export default async function StaffPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { course, modules } = await getAdminCourse(id); const cover = getCourseCoverUrl(course.cover_path);
  const status = { draft: "Черновик", published: "Опубликован", archived: "В архиве" }[course.status];
  return <section className="studio-page studio-preview-page"><div className="studio-preview-toolbar"><Link className="studio-back-link" href={`/admin/courses/${id}/edit`}><ArrowLeft aria-hidden="true" size={17} />В редактор</Link><span><Eye aria-hidden="true" size={16} />Предпросмотр для команды</span><Link href={`/admin/courses/${id}/edit`}><Pencil aria-hidden="true" size={16} />Редактировать</Link></div><header className="studio-preview-hero"><div className="studio-preview-cover">{cover ? <Image src={cover} alt={`Обложка курса «${course.title}»`} fill sizes="(max-width: 900px) 100vw, 48vw" priority /> : <div className="cover-placeholder">T</div>}</div><div><span className={`studio-status ${course.status}`}>{status}</span><p className="eyebrow">{formatCoursePrice(course.access_type, course.price_amount, course.currency)}</p><h1>{course.title}</h1><p className="hero-text">{course.description || course.short_description || "Описание ещё не заполнено."}</p></div></header><section className="studio-preview-curriculum"><div className="studio-section-heading"><div><p className="eyebrow">Программа</p><h2>Содержание курса</h2></div></div><CourseCurriculum modules={modules as never} admin courseId={id} /></section></section>;
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LessonEditor } from "@/components/lesson-editor";
import { getAdminCourse } from "@/lib/courses";
import { lessonTypes } from "@/lib/course-utils";

export default async function NewLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ module?: string; type?: string }> }) {
  const { id } = await params; const query = await searchParams; const data = await getAdminCourse(id);
  const moduleId = data.modules.some((module) => module.id === query.module) ? query.module! : data.modules[0]?.id;
  if (!moduleId) notFound();
  const lessonType = lessonTypes.includes(query.type as never) ? query.type as (typeof lessonTypes)[number] : "theory";
  return <section className="studio-page lesson-editor-page"><Link className="studio-back-link" href={`/admin/courses/${id}/edit#course-program`}><ArrowLeft aria-hidden="true" size={17} />{data.course.title}</Link><header className="studio-page-heading"><div><p className="eyebrow">Программа курса</p><h1>Новый урок</h1><p>Настройте содержание и доступность урока.</p></div></header><LessonEditor courseId={id} modules={data.modules} initial={{ moduleId, lessonType }} /></section>;
}

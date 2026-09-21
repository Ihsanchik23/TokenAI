import { notFound } from "next/navigation";
import { LessonEditor } from "@/components/lesson-editor";
import { getAdminCourse } from "@/lib/courses";
import { lessonTypes } from "@/lib/course-utils";

export default async function NewLessonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ module?: string; type?: string }> }) {
  const { id } = await params; const query = await searchParams; const data = await getAdminCourse(id);
  const moduleId = data.modules.some((module) => module.id === query.module) ? query.module! : data.modules[0]?.id;
  if (!moduleId) notFound();
  const lessonType = lessonTypes.includes(query.type as never) ? query.type as (typeof lessonTypes)[number] : "theory";
  return <section className="stack roomy"><div><p className="eyebrow">{data.course.title}</p><h2>Новый урок</h2></div><LessonEditor courseId={id} modules={data.modules} initial={{ moduleId, lessonType }} /></section>;
}

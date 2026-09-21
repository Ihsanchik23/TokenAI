import { CourseEditor } from "@/components/course-editor";
import { requireStaff } from "@/lib/auth";
import { getCourseOptions } from "@/lib/courses";

export default async function NewCoursePage() {
  const [staff, options] = await Promise.all([requireStaff(), getCourseOptions()]);
  return <section className="stack roomy"><div><p className="eyebrow">Новый курс</p><h2>Основные сведения</h2></div><CourseEditor {...options} currentUserId={staff.id} /></section>;
}

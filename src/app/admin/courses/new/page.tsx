import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CourseEditor } from "@/components/course-editor";
import { requireStaff } from "@/lib/auth";
import { getCourseOptions } from "@/lib/courses";

export default async function NewCoursePage() {
  const [staff, options] = await Promise.all([requireStaff(), getCourseOptions()]);
  return <section className="studio-page course-builder-page"><Link className="studio-back-link" href="/admin/courses"><ArrowLeft aria-hidden="true" size={17} />Все курсы</Link><header className="studio-page-heading"><div><p className="eyebrow">Новый курс</p><h1>Создать курс</h1><p>Сначала сохраните основные сведения, затем соберите программу и опубликуйте курс.</p></div></header><CourseEditor {...options} currentUserId={staff.id} /></section>;
}

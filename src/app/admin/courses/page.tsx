import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCoursePrice } from "@/lib/course-utils";

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("courses").select("id,title,slug,status,access_type,price_amount,currency,level,updated_at,course_instructors(profiles(display_name,username))").order("updated_at", { ascending: false });
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  if (["draft", "published", "archived"].includes(status)) query = query.eq("status", status);
  const { data: courses } = await query;
  return <section className="stack roomy"><div className="actions split"><div><h2>Курсы</h2><p className="muted">Черновики и опубликованные программы.</p></div><Link className="button" href="/admin/courses/new">Новый курс</Link></div><form className="card filter-row"><input name="q" placeholder="Поиск по названию" defaultValue={q} /><select name="status" defaultValue={status}><option value="">Все статусы</option><option value="draft">Черновики</option><option value="published">Опубликованные</option><option value="archived">Архив</option></select><button className="button secondary">Найти</button></form><div className="stack">{courses?.length ? courses.map((course) => <article className="card course-row" key={course.id}><div className="stack compact"><div className="actions"><span className={`badge ${course.status}`}>{course.status}</span><span className="muted">{course.level}</span></div><h2>{course.title}</h2><p className="muted">/{course.slug} · {formatCoursePrice(course.access_type, course.price_amount, course.currency)}</p></div><div className="actions"><Link href={`/admin/courses/${course.id}/preview`}>Preview</Link><Link className="button small secondary" href={`/admin/courses/${course.id}/edit`}>Редактировать</Link></div></article>) : <div className="card center stack"><h2>Курсов пока нет</h2><p className="muted">Создайте первый черновик курса.</p></div>}</div></section>;
}

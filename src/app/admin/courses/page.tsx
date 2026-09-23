import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus, Search } from "lucide-react";
import { CourseRowActions } from "@/components/course-row-actions";
import { createClient } from "@/lib/supabase/server";
import { formatCoursePrice } from "@/lib/course-utils";

const statusLabels = { draft: "Черновик", published: "Опубликован", archived: "В архиве" } as const;
const levelLabels = { beginner: "Начальный", intermediate: "Средний", advanced: "Продвинутый" } as const;
const statusLabel = (value: string) => statusLabels[value as keyof typeof statusLabels] ?? value;
const levelLabel = (value: string) => levelLabels[value as keyof typeof levelLabels] ?? value;

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; access?: string }> }) {
  const { q = "", status = "", access = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("courses").select("id,title,slug,status,access_type,price_amount,currency,level,updated_at,course_instructors(profiles(display_name,username))").order("updated_at", { ascending: false });
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  if (["draft", "published", "archived"].includes(status)) query = query.eq("status", status);
  if (["free", "paid", "private"].includes(access)) query = query.eq("access_type", access);
  const { data: courses } = await query;
  const filtered = Boolean(q || status || access);
  return <section className="studio-page">
    <header className="studio-page-heading"><div><p className="eyebrow">Контент</p><h1>Курсы</h1><p>Черновики, публикации и архивные программы.</p></div><Link className="button" href="/admin/courses/new"><Plus aria-hidden="true" size={18} />Новый курс</Link></header>
    <form className="studio-filter-bar course-filter-bar" role="search"><label><Search aria-hidden="true" size={18} /><span className="visually-hidden">Поиск по названию</span><input name="q" placeholder="Поиск по названию" defaultValue={q} /></label><label><span className="visually-hidden">Статус курса</span><select name="status" defaultValue={status}><option value="">Все статусы</option><option value="draft">Черновики</option><option value="published">Опубликованные</option><option value="archived">Архив</option></select></label><label><span className="visually-hidden">Тип доступа</span><select name="access" defaultValue={access}><option value="">Любой доступ</option><option value="free">Бесплатный</option><option value="paid">Платный</option><option value="private">Закрытый</option></select></label><button className="button secondary">Найти</button></form>
    {courses?.length ? <div className="studio-table-wrap"><table className="studio-table course-management-table"><thead><tr><th>Курс</th><th>Статус</th><th>Доступ</th><th>Преподаватель</th><th>Обновлён</th><th><span className="visually-hidden">Действия</span></th></tr></thead><tbody>{courses.map((course) => { const instructor = course.course_instructors[0]?.profiles[0]; return <tr key={course.id}><td data-label="Курс"><Link className="studio-course-title" href={`/admin/courses/${course.id}/edit`}><strong>{course.title}</strong><small>/{course.slug} · {levelLabel(course.level)}</small></Link></td><td data-label="Статус"><span className={`studio-status ${course.status}`}>{statusLabel(course.status)}</span></td><td data-label="Доступ"><span>{formatCoursePrice(course.access_type, course.price_amount, course.currency)}</span></td><td data-label="Преподаватель"><span>{instructor?.display_name || (instructor?.username ? `@${instructor.username}` : "—")}</span></td><td data-label="Обновлён"><time dateTime={course.updated_at}>{new Date(course.updated_at).toLocaleDateString("ru-RU")}</time></td><td className="studio-row-actions"><CourseRowActions id={course.id} title={course.title} status={course.status} /></td></tr>; })}</tbody></table></div> : <div className="studio-empty"><BookOpen aria-hidden="true" size={27} /><h2>{filtered ? "Курсы не найдены" : "Курсов пока нет"}</h2><p>{filtered ? "Измените поиск или фильтры." : "Создайте первый черновик и соберите программу."}</p>{!filtered && <Link className="button" href="/admin/courses/new">Создать курс<ArrowUpRight aria-hidden="true" size={17} /></Link>}</div>}
  </section>;
}

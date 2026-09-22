import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { StudentCard } from "@/components/student-card";
import type { PublicStudent, PublicTopic } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";

type DirectoryResult = { items: PublicStudent[]; total: number; page: number; pageSize: number };

function pageHref(query: { q: string; topic: string }, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.topic) params.set("topic", query.topic);
  params.set("page", String(page));
  return `/students?${params}`;
}

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";
  const topic = typeof raw.topic === "string" && /^[a-z0-9-]{1,80}$/.test(raw.topic) ? raw.topic : "";
  const page = Math.max(1, Math.min(1000, Number.parseInt(typeof raw.page === "string" ? raw.page : "1", 10) || 1));
  const supabase = await createClient();
  const [{ data }, { data: topicRows }] = await Promise.all([
    supabase.rpc("list_public_students", { search_text: q, topic_slug: topic, page_number: page, page_size: 12 }),
    supabase.from("topics").select("id,name,slug").order("name"),
  ]);
  const result = (data ?? { items: [], total: 0, page, pageSize: 12 }) as DirectoryResult;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="page-shell community-page students-page">
      <header className="community-heading"><p className="eyebrow">Сообщество</p><h1>Создатели<br />TokenAI</h1><p className="hero-text">Открывайте профили участников, их направления и опубликованные работы.</p></header>
      <nav className="secondary-nav community-tabs" aria-label="Раздел сообщества">
        <Link className="active" href="/students" aria-current="page">Студенты</Link>
        <Link href="/showcase">Работы</Link>
      </nav>
      <form className="community-filter" role="search">
        <label className="community-search"><Search aria-hidden="true" size={19} /><span className="visually-hidden">Поиск студента</span><input name="q" defaultValue={q} maxLength={80} placeholder="Имя или @username" /></label>
        <label className="community-select"><SlidersHorizontal aria-hidden="true" size={18} /><span className="visually-hidden">Фильтр по интересам</span><select name="topic" defaultValue={topic}><option value="">Все интересы</option>{((topicRows ?? []) as PublicTopic[]).map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select></label>
        <button className="button" type="submit">Найти</button>
      </form>
      <div className="community-result-count"><span>Публичные профили</span><strong>{result.total}</strong></div>
      <section className="student-list" aria-label="Список студентов">{result.items.length ? result.items.map((student) => <StudentCard student={student} key={student.id} />) : <div className="community-empty"><span aria-hidden="true">0</span><h2>Профили не найдены</h2><p className="muted">Измените имя или выбранный интерес.</p><Link className="button secondary" href="/students">Сбросить фильтры</Link></div>}</section>
      {totalPages > 1 && <nav className="pagination">{result.page > 1 && <Link className="button secondary" href={pageHref({ q, topic }, result.page - 1)}>← Назад</Link>}<span>Страница {result.page} из {totalPages}</span>{result.page < totalPages && <Link className="button secondary" href={pageHref({ q, topic }, result.page + 1)}>Далее →</Link>}</nav>}
    </main>
  );
}

import Link from "next/link";
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
    <main className="page-shell stack roomy">
      <header className="stack compact"><p className="eyebrow">Сообщество</p><h1>Студенты TokenAI</h1><p className="muted">Публичные профили, достижения и работы участников.</p></header>
      <nav className="secondary-nav" aria-label="Раздел сообщества">
        <Link className="active" href="/students" aria-current="page">Студенты</Link>
        <Link href="/showcase">Работы</Link>
      </nav>
      <form className="card filter-row directory-filters">
        <input name="q" defaultValue={q} maxLength={80} placeholder="Имя или username" />
        <select name="topic" defaultValue={topic}><option value="">Все интересы</option>{((topicRows ?? []) as PublicTopic[]).map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select>
        <button className="button">Найти</button>
      </form>
      <p className="muted">Найдено профилей: {result.total}</p>
      <section className="course-grid">{result.items.length ? result.items.map((student) => <StudentCard student={student} key={student.id} />) : <div className="card center"><p className="muted">Публичных профилей по этим условиям нет.</p></div>}</section>
      {totalPages > 1 && <nav className="pagination">{result.page > 1 && <Link className="button secondary" href={pageHref({ q, topic }, result.page - 1)}>← Назад</Link>}<span>Страница {result.page} из {totalPages}</span>{result.page < totalPages && <Link className="button secondary" href={pageHref({ q, topic }, result.page + 1)}>Далее →</Link>}</nav>}
    </main>
  );
}

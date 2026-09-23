import Link from "next/link";
import { StudentCard } from "@/components/student-card";
import { StudentFilters } from "@/components/student-filters";
import type { PublicStudent, PublicTopic } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";

type DirectoryResult = { items: PublicStudent[]; total: number; page: number; pageSize: number };

function pageHref(query: { q: string; topics: string[] }, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  query.topics.forEach((topic) => params.append("topic", topic));
  params.set("page", String(page));
  return `/students?${params}`;
}

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 80) : "";
  const rawTopics = Array.isArray(raw.topic) ? raw.topic : typeof raw.topic === "string" ? [raw.topic] : [];
  const selectedTopics = [...new Set(rawTopics.filter((topic) => /^[a-z0-9-]{1,80}$/.test(topic)))];
  const page = Math.max(1, Math.min(1000, Number.parseInt(typeof raw.page === "string" ? raw.page : "1", 10) || 1));
  const supabase = await createClient();
  const [{ data }, { data: topicRows }] = await Promise.all([
    supabase.rpc("list_public_students_filtered", { search_text: q, topic_slugs: selectedTopics, page_number: page, page_size: 12 }),
    supabase.from("topics").select("id,name,slug").order("name"),
  ]);
  const result = (data ?? { items: [], total: 0, page, pageSize: 12 }) as DirectoryResult;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="page-shell community-page students-page">
      <header className="community-heading"><h1>Сообщество</h1></header>
      <nav className="secondary-nav community-tabs" aria-label="Раздел сообщества">
        <Link className="active" href="/students" aria-current="page">Студенты</Link>
        <Link href="/showcase">Работы</Link>
      </nav>
      <StudentFilters key={[q, ...selectedTopics].join("|")} topics={(topicRows ?? []) as PublicTopic[]} query={q} selectedTopics={selectedTopics} />
      <section className="student-list" aria-label="Список студентов">{result.items.length ? result.items.map((student) => <StudentCard student={student} key={student.id} />) : <div className="community-empty"><span aria-hidden="true">0</span><h2>Профили не найдены</h2><p className="muted">Измените имя или выбранный интерес.</p><Link className="button secondary" href="/students">Сбросить фильтры</Link></div>}</section>
      {totalPages > 1 && <nav className="pagination">{result.page > 1 && <Link className="button secondary" href={pageHref({ q, topics: selectedTopics }, result.page - 1)}>← Назад</Link>}<span>Страница {result.page} из {totalPages}</span>{result.page < totalPages && <Link className="button secondary" href={pageHref({ q, topics: selectedTopics }, result.page + 1)}>Далее →</Link>}</nav>}
    </main>
  );
}

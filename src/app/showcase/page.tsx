import Link from "next/link";
import { ShowcaseCard } from "@/components/showcase-card";
import { getShowcaseCoverUrls, type PublicTopic, type ShowcaseWork } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";

type ShowcaseResult = { items: ShowcaseWork[]; total: number; page: number; pageSize: number };

function pageHref(query: { q: string; topic: string; author: string }, page: number) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.topic) params.set("topic", query.topic);
  if (query.author) params.set("author", query.author);
  params.set("page", String(page));
  return `/showcase?${params}`;
}

export default async function ShowcasePage({ searchParams }: PageProps<"/showcase">) {
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 100) : "";
  const topic = typeof raw.topic === "string" && /^[a-z0-9-]{1,80}$/.test(raw.topic) ? raw.topic : "";
  const author = typeof raw.author === "string" ? raw.author.trim().toLowerCase().slice(0, 48) : "";
  const page = Math.max(1, Math.min(1000, Number.parseInt(typeof raw.page === "string" ? raw.page : "1", 10) || 1));
  const supabase = await createClient();
  const [{ data }, { data: topicRows }] = await Promise.all([
    supabase.rpc("list_published_showcase", { search_text: q, topic_slug: topic, author_username: author, page_number: page, page_size: 12 }),
    supabase.from("topics").select("id,name,slug").order("name"),
  ]);
  const result = (data ?? { items: [], total: 0, page, pageSize: 12 }) as ShowcaseResult;
  const covers = await getShowcaseCoverUrls(supabase, result.items.map((work) => work.coverPath));
  const works = result.items.map((work) => ({ ...work, coverUrl: work.coverPath ? covers.get(work.coverPath) ?? null : null }));
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <main className="page-shell stack roomy">
      <header className="stack compact"><p className="eyebrow">Работы студентов</p><h1>TokenAI Showcase</h1><p className="muted">Опубликованные проекты участников, новые работы показаны первыми.</p></header>
      <form className="card showcase-filters">
        <input name="q" defaultValue={q} maxLength={100} placeholder="Поиск по работам" />
        <select name="topic" defaultValue={topic}><option value="">Все категории</option>{((topicRows ?? []) as PublicTopic[]).map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select>
        <input name="author" defaultValue={author} maxLength={48} placeholder="Username автора" />
        <button className="button">Применить</button>
      </form>
      <p className="muted">Опубликовано работ: {result.total}</p>
      <section className="course-grid">{works.length ? works.map((work) => <ShowcaseCard work={work} key={work.id} />) : <div className="card center"><p className="muted">Работ по этим условиям нет.</p></div>}</section>
      {totalPages > 1 && <nav className="pagination">{result.page > 1 && <Link className="button secondary" href={pageHref({ q, topic, author }, result.page - 1)}>← Назад</Link>}<span>Страница {result.page} из {totalPages}</span>{result.page < totalPages && <Link className="button secondary" href={pageHref({ q, topic, author }, result.page + 1)}>Далее →</Link>}</nav>}
    </main>
  );
}

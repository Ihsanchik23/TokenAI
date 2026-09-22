import Link from "next/link";
import { Search, SlidersHorizontal, UserRound } from "lucide-react";
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
    <main className="page-shell community-page showcase-page">
      <header className="community-heading showcase-heading"><p className="eyebrow">Работы студентов</p><h1>Создано<br />с AI.</h1><p className="hero-text">Галерея опубликованных проектов сообщества TokenAI.</p></header>
      <nav className="secondary-nav community-tabs" aria-label="Раздел сообщества">
        <Link href="/students">Студенты</Link>
        <Link className="active" href="/showcase" aria-current="page">Работы</Link>
      </nav>
      <form className="community-filter showcase-filter" role="search">
        <label className="community-search"><Search aria-hidden="true" size={19} /><span className="visually-hidden">Поиск по работам</span><input name="q" defaultValue={q} maxLength={100} placeholder="Название работы" /></label>
        <label className="community-select"><SlidersHorizontal aria-hidden="true" size={18} /><span className="visually-hidden">Категория</span><select name="topic" defaultValue={topic}><option value="">Все категории</option>{((topicRows ?? []) as PublicTopic[]).map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select></label>
        <label className="community-search author-search"><UserRound aria-hidden="true" size={18} /><span className="visually-hidden">Username автора</span><input name="author" defaultValue={author} maxLength={48} placeholder="@автор" /></label>
        <button className="button" type="submit">Показать</button>
      </form>
      <div className="community-result-count"><span>Опубликованные работы</span><strong>{result.total}</strong></div>
      <section className="showcase-gallery" aria-label="Галерея работ">{works.length ? works.map((work, index) => <ShowcaseCard work={work} priority={index < 2} key={work.id} />) : <div className="community-empty"><span aria-hidden="true">0</span><h2>Работы не найдены</h2><p className="muted">Измените фильтры или вернитесь ко всем работам.</p><Link className="button secondary" href="/showcase">Сбросить фильтры</Link></div>}</section>
      {totalPages > 1 && <nav className="pagination">{result.page > 1 && <Link className="button secondary" href={pageHref({ q, topic, author }, result.page - 1)}>← Назад</Link>}<span>Страница {result.page} из {totalPages}</span>{result.page < totalPages && <Link className="button secondary" href={pageHref({ q, topic, author }, result.page + 1)}>Далее →</Link>}</nav>}
    </main>
  );
}

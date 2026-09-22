import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShowcaseCoverUrls, type ShowcaseWork } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ShowcaseWorkPage({ params }: PageProps<"/showcase/[id]">) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_published_showcase_work", { target_work_id: id });
  if (error || !data) notFound();
  const work = data as ShowcaseWork;
  const covers = await getShowcaseCoverUrls(supabase, [work.coverPath]);
  const coverUrl = work.coverPath ? covers.get(work.coverPath) ?? null : null;

  return (
    <main className="page-shell narrow-content stack roomy">
      <Link href="/showcase">← Все работы</Link>
      {coverUrl ? <Image className="showcase-detail-cover" src={coverUrl} alt={`Обложка ${work.title}`} width={960} height={540} unoptimized /> : <div className="cover-placeholder showcase-detail-cover">Showcase</div>}
      <article className="card stack roomy">
        <header className="stack compact"><div className="actions split"><span className="tag">{work.topic.name}</span><span className="muted">{new Date(work.publishedAt).toLocaleDateString("ru-RU")}</span></div><h1>{work.title}</h1><p className="muted">Автор: {work.author ? <Link href={`/students/${work.author.username}`}>{work.author.displayName ?? `@${work.author.username}`}</Link> : "Участник TokenAI"}</p></header>
        {work.description && <div className="lesson-content">{work.description}</div>}
        {work.relatedCourse && <section className="notice"><strong>Связано с курсом:</strong> {work.relatedCourse.status === "published" ? <Link href={`/courses/${work.relatedCourse.slug}`}>{work.relatedCourse.title}</Link> : work.relatedCourse.title}{work.relatedCourse.lessonTitle ? ` · ${work.relatedCourse.lessonTitle}` : ""}</section>}
        {work.externalUrl && <a className="button" href={work.externalUrl} target="_blank" rel="noopener noreferrer">Открыть проект ↗</a>}
      </article>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays } from "lucide-react";
import { getShowcaseCoverUrls, type ShowcaseWork } from "@/lib/showcase";
import { getAvatarUrl } from "@/lib/storage";
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
  const avatarUrl = getAvatarUrl(work.author?.avatarPath ?? null);
  const authorName = work.author ? work.author.displayName ?? `@${work.author.username}` : "Участник TokenAI";

  return (
    <main className="showcase-detail-page page-shell">
      <Link className="player-back-link" href="/showcase"><ArrowLeft aria-hidden="true" size={17} />Все работы</Link>
      <div className="showcase-detail-media">{coverUrl ? <Image src={coverUrl} alt={`Работа «${work.title}»`} width={1600} height={1200} sizes="(max-width: 900px) 100vw, 1280px" priority /> : <div className="showcase-missing-media"><span>TokenAI</span><small>Изображение не добавлено</small></div>}</div>
      <article className="showcase-detail-info">
        <header className="showcase-detail-heading"><div className="tag-list"><span className="tag">{work.topic.name}</span><span className="showcase-date"><CalendarDays aria-hidden="true" size={16} />{new Date(work.publishedAt).toLocaleDateString("ru-RU")}</span></div><h1>{work.title}</h1></header>
        <div className="showcase-detail-side">
          {work.author ? <Link className="showcase-author" href={`/students/${work.author.username}`}><span className="showcase-author-avatar">{avatarUrl ? <Image src={avatarUrl} alt="" width={46} height={46} unoptimized /> : authorName.charAt(0).toUpperCase()}</span><span><small>Автор</small><strong>{authorName}</strong></span></Link> : <div className="showcase-author"><span className="showcase-author-avatar">T</span><span><small>Автор</small><strong>{authorName}</strong></span></div>}
          {work.externalUrl && <a className="button" href={work.externalUrl} target="_blank" rel="noopener noreferrer">Открыть проект<ArrowUpRight aria-hidden="true" size={18} /></a>}
        </div>
        <div className="showcase-description">{work.description ? <div className="lesson-content">{work.description}</div> : <p className="muted">Автор не добавил описание.</p>}</div>
        {work.relatedCourse && <aside className="related-course"><BookOpen aria-hidden="true" size={20} /><div><small>Связано с курсом</small><strong>{work.relatedCourse.status === "published" ? <Link href={`/courses/${work.relatedCourse.slug}`}>{work.relatedCourse.title}</Link> : work.relatedCourse.title}</strong>{work.relatedCourse.lessonTitle && <span>{work.relatedCourse.lessonTitle}</span>}</div></aside>}
      </article>
    </main>
  );
}

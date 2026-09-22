import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ImageIcon, UserRound } from "lucide-react";
import { ShowcaseModeration } from "@/components/showcase-moderation";
import { getShowcaseCoverUrls } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";

type ModerationRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_path: string | null;
  external_url: string | null;
  created_at: string;
  topic: Array<{ name: string }>;
  submission: Array<{
    assignment: Array<{
      lesson: Array<{ title: string; module: Array<{ course: Array<{ title: string }> }> }>;
    }>;
  }>;
};

export default async function AdminShowcasePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("showcase_works")
    .select("id,user_id,title,description,cover_path,external_url,created_at,topic:topics(name),submission:assignment_submissions(assignment:assignments(lesson:lessons(title,module:modules(course:courses(title)))))")
    .eq("status", "pending")
    .order("created_at");
  const rows = (data ?? []) as unknown as ModerationRow[];
  const [{ data: profiles }, covers] = await Promise.all([
    rows.length ? supabase.from("profiles").select("id,display_name,username").in("id", [...new Set(rows.map((work) => work.user_id))]) : Promise.resolve({ data: [] }),
    getShowcaseCoverUrls(supabase, rows.map((work) => work.cover_path)),
  ]);
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <section className="studio-page studio-moderation-page">
      <header className="studio-page-heading"><div><p className="eyebrow">Модерация</p><h1>Showcase</h1><p>Администратор видит все работы; преподаватель — работы из заданий своих курсов.</p></div><span className="studio-heading-count">{rows.length}</span></header>
      <div className="moderation-grid">{rows.length ? rows.map((work) => {
        const author = profileById.get(work.user_id);
        const lesson = work.submission[0]?.assignment[0]?.lesson[0];
        const course = lesson?.module[0]?.course[0];
        const coverUrl = work.cover_path ? covers.get(work.cover_path) : null;
        return <article className="moderation-item" key={work.id}><div className="moderation-media">{coverUrl ? <Image src={coverUrl} alt={`Обложка работы «${work.title}»`} fill sizes="(max-width: 800px) 100vw, 42vw" /> : <div className="showcase-missing-media"><ImageIcon aria-hidden="true" size={30} /><span>Без обложки</span></div>}<span className="studio-status pending">На модерации</span></div><div className="moderation-copy"><div className="moderation-title"><span>{work.topic[0]?.name ?? "Без категории"}</span><h2>{work.title}</h2></div><div className="moderation-author"><UserRound aria-hidden="true" size={17} /><span><strong>{author?.display_name ?? `@${author?.username ?? "student"}`}</strong><small>{new Date(work.created_at).toLocaleString("ru-RU")}</small></span></div>{work.description ? <p className="moderation-description">{work.description}</p> : <p className="moderation-description muted">Описание не добавлено.</p>}<dl className="moderation-source"><div><dt>Источник</dt><dd>{course ? `${course.title} · ${lesson.title}` : "Самостоятельная работа"}</dd></div></dl>{work.external_url && <a className="moderation-project-link" href={work.external_url} target="_blank" rel="noopener noreferrer">Открыть проект<ArrowUpRight aria-hidden="true" size={16} /></a>}<ShowcaseModeration workId={work.id} /></div></article>;
      }) : <div className="studio-empty moderation-empty"><ImageIcon aria-hidden="true" size={28} /><h2>Очередь пуста</h2><p>Работ на модерации сейчас нет.</p><Link href="/showcase">Открыть публичный Showcase<ArrowUpRight aria-hidden="true" size={16} /></Link></div>}</div>
    </section>
  );
}

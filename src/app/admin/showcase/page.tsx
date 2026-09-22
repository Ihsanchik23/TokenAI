import Image from "next/image";
import Link from "next/link";
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
    <section className="stack roomy">
      <div><p className="eyebrow">Модерация</p><h2>Showcase</h2><p className="muted">Администратор видит все работы; преподаватель — работы из заданий своих курсов.</p></div>
      <div className="stack">{rows.length ? rows.map((work) => {
        const author = profileById.get(work.user_id);
        const lesson = work.submission[0]?.assignment[0]?.lesson[0];
        const course = lesson?.module[0]?.course[0];
        const coverUrl = work.cover_path ? covers.get(work.cover_path) : null;
        return <article className="card moderation-work" key={work.id}><div>{coverUrl ? <Image src={coverUrl} alt={`Обложка ${work.title}`} width={480} height={270} unoptimized /> : <div className="cover-placeholder">Showcase</div>}</div><div className="stack"><div><p className="eyebrow">{work.topic[0]?.name ?? "Без категории"}</p><h3>{work.title}</h3><p className="field-help">{author?.display_name ?? `@${author?.username ?? "student"}`} · {new Date(work.created_at).toLocaleString("ru-RU")}</p></div>{work.description && <p>{work.description}</p>}{course && <p className="notice">{course.title} · {lesson.title}</p>}{work.external_url && <a href={work.external_url} target="_blank" rel="noopener noreferrer">Открыть проект ↗</a>}<ShowcaseModeration workId={work.id} /></div></article>;
      }) : <div className="card center"><p className="muted">Работ на модерации нет.</p><Link href="/showcase">Открыть публичный Showcase</Link></div>}</div>
    </section>
  );
}

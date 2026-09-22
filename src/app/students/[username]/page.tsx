import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShowcaseCard } from "@/components/showcase-card";
import { getShowcaseCoverUrls, type PublicStudentProfile, type ShowcaseWork } from "@/lib/showcase";
import { getAvatarUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export default async function PublicProfilePage({ params }: PageProps<"/students/[username]">) {
  const { username } = await params;
  if (!/^[a-z0-9_]{3,48}$/i.test(username)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_student_profile", {
    target_username: username.toLowerCase(),
  });
  if (error || !data) notFound();
  const profile = data as PublicStudentProfile;
  const avatarUrl = getAvatarUrl(profile.avatarPath);
  const name = profile.displayName ?? profile.username;
  const coverUrls = await getShowcaseCoverUrls(supabase, profile.publishedWorks.map((work) => work.coverPath));
  const works: ShowcaseWork[] = profile.publishedWorks.map((work) => ({
    ...work,
    coverUrl: work.coverPath ? coverUrls.get(work.coverPath) ?? null : null,
    author: { displayName: profile.displayName, username: profile.username, avatarPath: profile.avatarPath },
    relatedCourse: null,
  }));

  return (
    <main className="page-shell profile-shell">
      <section className="card public-profile-header">
        <div className="avatar avatar-large">{avatarUrl ? <Image src={avatarUrl} alt={`Аватар ${name}`} width={112} height={112} unoptimized /> : <span>{name.charAt(0).toUpperCase()}</span>}</div>
        <div className="stack compact"><p className="eyebrow">Участник TokenAI</p><h1>{name}</h1><p className="handle">@{profile.username}</p>{profile.bio && <p>{profile.bio}</p>}</div>
      </section>

      <section className="card stack"><h2>Интересы</h2>{profile.topics.length ? <div className="tag-list">{profile.topics.map((topic) => <span className="tag" key={topic.id}>{topic.name}</span>)}</div> : <p className="muted">Интересы пока не выбраны.</p>}</section>

      <section className="card stack"><div><p className="eyebrow">Обучение</p><h2>Завершённые курсы</h2></div>{profile.completedCourses.length ? profile.completedCourses.map((course) => <article className="course-row" key={course.id}><div><strong>{course.title}</strong><p className="field-help">Завершён {new Date(course.completedAt).toLocaleDateString("ru-RU")}</p></div>{course.status === "published" && <Link href={`/courses/${course.slug}`}>О курсе</Link>}</article>) : <p className="muted">Завершённых курсов пока нет.</p>}</section>

      <section className="card stack"><div><p className="eyebrow">Достижения</p><h2>Сертификаты</h2></div>{profile.certificates.length ? profile.certificates.map((certificate) => <article className="certificate-card actions split" key={certificate.id}><div><strong>{certificate.courseTitle}</strong><p className="field-help">{certificate.code}</p></div><Link href={`/certificate/${certificate.code}`}>Проверить</Link></article>) : <p className="muted">Сертификатов пока нет.</p>}</section>

      <section className="stack"><div><p className="eyebrow">Showcase</p><h2>Опубликованные работы</h2></div>{works.length ? <div className="course-grid">{works.map((work) => <ShowcaseCard work={work} key={work.id} />)}</div> : <div className="card"><p className="muted">Опубликованных работ пока нет.</p></div>}</section>
    </main>
  );
}

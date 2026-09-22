import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BookOpen, CheckCircle2 } from "lucide-react";
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
    <main className="page-shell public-portfolio">
      <header className="portfolio-identity">
        <div className="avatar portfolio-avatar">{avatarUrl ? <Image src={avatarUrl} alt={`Аватар ${name}`} width={148} height={148} unoptimized /> : <span>{name.charAt(0).toUpperCase()}</span>}</div>
        <div className="portfolio-identity-copy"><p className="eyebrow">Портфолио TokenAI</p><h1>{name}</h1><p className="handle">@{profile.username}</p>{profile.bio && <p className="portfolio-bio">{profile.bio}</p>}{profile.topics.length ? <div className="tag-list">{profile.topics.map((topic) => <span className="tag" key={topic.id}>{topic.name}</span>)}</div> : <p className="muted">Интересы пока не указаны.</p>}</div>
        <div className="portfolio-summary" aria-label="Сводка профиля"><div><strong>{works.length}</strong><span>Работы</span></div><div><strong>{profile.completedCourses.length}</strong><span>Курсы</span></div><div><strong>{profile.certificates.length}</strong><span>Сертификаты</span></div></div>
      </header>

      <section className="portfolio-section portfolio-works"><div className="portfolio-section-heading"><div><p className="eyebrow">Работы</p><h2>Опубликованные проекты</h2></div><span>{works.length}</span></div>{works.length ? <div className="showcase-gallery profile-work-gallery">{works.map((work, index) => <ShowcaseCard work={work} priority={index < 2} key={work.id} />)}</div> : <div className="portfolio-empty"><p>Опубликованных работ пока нет.</p></div>}</section>

      <div className="portfolio-learning-grid">
        <section className="portfolio-section"><div className="portfolio-section-heading"><div><p className="eyebrow">Обучение</p><h2>Завершённые курсы</h2></div><BookOpen aria-hidden="true" size={22} /></div><div className="portfolio-record-list">{profile.completedCourses.length ? profile.completedCourses.map((course) => <article className="portfolio-record" key={course.id}><CheckCircle2 aria-hidden="true" size={19} /><div><strong>{course.title}</strong><p>Завершён {new Date(course.completedAt).toLocaleDateString("ru-RU")}</p></div>{course.status === "published" && <Link href={`/courses/${course.slug}`}>О курсе</Link>}</article>) : <p className="portfolio-empty">Завершённых курсов пока нет.</p>}</div></section>

        <section className="portfolio-section"><div className="portfolio-section-heading"><div><p className="eyebrow">Достижения</p><h2>Сертификаты</h2></div><Award aria-hidden="true" size={22} /></div><div className="portfolio-record-list">{profile.certificates.length ? profile.certificates.map((certificate) => <article className="portfolio-record" key={certificate.id}><Award aria-hidden="true" size={19} /><div><strong>{certificate.courseTitle}</strong><p>{certificate.code}</p></div><Link href={`/certificate/${certificate.code}`}>Проверить</Link></article>) : <p className="portfolio-empty">Сертификатов пока нет.</p>}</div></section>
      </div>
    </main>
  );
}

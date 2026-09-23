import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Award, BookOpen, Pencil, Plus, Send } from "lucide-react";
import { deleteShowcaseWorkFormAction, submitShowcaseWorkFormAction } from "@/app/showcase/actions";
import { CertificateCard } from "@/components/certificate-card";
import { ConfirmButton } from "@/components/confirm-button";
import { requireUser } from "@/lib/auth";
import { getCertificateDownloadUrl } from "@/lib/certificates";
import { getCourseCoverUrl } from "@/lib/course-utils";
import {
  ensureMyProfile,
  getMyProfile,
  isProfileComplete,
  type Topic,
} from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { getShowcaseCoverUrls } from "@/lib/showcase";
import { getAvatarUrl } from "@/lib/storage";

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, user.id);

  if (!profile || !isProfileComplete(profile)) {
    redirect("/onboarding");
  }

  const [{ data: topics, error: topicsError }, { data: selected }, { data: certificateRows }, { data: showcaseRows }, { data: enrollmentRows }] =
    await Promise.all([
      supabase.from("topics").select("id, name, slug").order("name"),
      supabase
        .from("profile_topics")
        .select("topic_id")
        .eq("profile_id", user.id),
      supabase
        .from("certificates")
        .select("id,certificate_code,issued_at,pdf_path,enrollment:enrollments!inner(user_id,course:courses(title,cover_path))")
        .eq("enrollment.user_id", user.id)
        .order("issued_at", { ascending: false }),
      supabase
        .from("showcase_works")
        .select("id,title,status,moderation_comment,created_at,published_at,cover_path,topic:topics(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("enrollments")
        .select("id,status,started_at,completed_at,course:courses(id,slug,title,cover_path,status)")
        .eq("user_id", user.id)
        .in("status", ["active", "completed"])
        .order("access_granted_at", { ascending: false }),
    ]);

  if (topicsError) {
    throw new Error("Topics unavailable");
  }

  const certificates = await Promise.all((certificateRows ?? []).map(async (certificate) => ({
    id: certificate.id,
    certificate_code: certificate.certificate_code,
    issued_at: certificate.issued_at,
    pdf_path: certificate.pdf_path,
    courseTitle: certificate.enrollment[0]?.course[0]?.title ?? "Курс TokenAI",
    courseCoverUrl: getCourseCoverUrl(certificate.enrollment[0]?.course[0]?.cover_path ?? null),
    downloadUrl: await getCertificateDownloadUrl(supabase, certificate.pdf_path),
  })));
  const workCovers = await getShowcaseCoverUrls(supabase, (showcaseRows ?? []).map((work) => work.cover_path));
  const selectedTopics = ((topics ?? []) as Topic[]).filter((topic) => (selected ?? []).some((item) => item.topic_id === topic.id));
  const statusLabels: Record<string, string> = { draft: "Черновик", pending: "На модерации", published: "Опубликовано", rejected: "Отклонено" };
  const avatarUrl = getAvatarUrl(profile.avatar_path);
  const completedCourseCount = (enrollmentRows ?? []).filter((enrollment) => enrollment.status === "completed").length;
  const activeCourseCount = (enrollmentRows ?? []).length - completedCourseCount;

  return (
    <main className="page-shell own-profile-page">
      <header className="own-profile-heading"><h1>Ваш профиль</h1></header>
      <section className="own-profile-identity">
        <div className="avatar own-profile-avatar">{avatarUrl ? <Image src={avatarUrl} alt={`Аватар ${profile.display_name}`} width={148} height={148} unoptimized /> : <span>{profile.display_name?.charAt(0).toUpperCase() || "T"}</span>}</div>
        <div className="own-profile-copy">
          <div className="own-profile-name-row"><div><h2>{profile.display_name}</h2><p className="handle">@{profile.username}</p></div><Link className="button secondary profile-edit-button" href="/profile/edit"><Pencil aria-hidden="true" size={16} />Редактировать</Link></div>
          <div className="portfolio-summary own-profile-stats"><div><strong>{(enrollmentRows ?? []).length}</strong><span>Курсы</span></div><div><strong>{activeCourseCount}</strong><span>Активные</span></div><div><strong>{completedCourseCount}</strong><span>Завершено</span></div></div>
          {profile.bio && <p className="portfolio-bio">{profile.bio}</p>}
          {selectedTopics.length ? <div className="tag-list">{selectedTopics.map((topic) => <span className="tag" key={topic.id}>{topic.name}</span>)}</div> : <p className="muted">Добавьте интересы, чтобы заполнить профиль.</p>}
        </div>
      </section>

      <section className="own-profile-section own-works-section">
        <div className="portfolio-section-heading"><div><p className="eyebrow">Портфолио</p><h2>Мои работы</h2></div><Link className="button small" href="/profile/showcase/new"><Plus aria-hidden="true" size={17} />Добавить работу</Link></div>
        {(showcaseRows ?? []).length ? <div className="owner-work-grid">{(showcaseRows ?? []).map((work) => { const cover = work.cover_path ? workCovers.get(work.cover_path) ?? null : null; return <article className="owner-work-item" key={work.id}><div className="owner-work-media">{cover ? <Image src={cover} alt={`Обложка работы «${work.title}»`} fill sizes="(max-width: 700px) 100vw, 33vw" /> : <div className="showcase-missing-media"><span>T</span><small>Без обложки</small></div>}<span className={`moderation-status ${work.status}`}>{statusLabels[work.status]}</span></div><div className="owner-work-copy"><p>{work.topic[0]?.name ?? "Showcase"}</p><h3>{work.title}</h3>{work.moderation_comment && <div className="moderation-comment"><strong>Комментарий модератора</strong><span>{work.moderation_comment}</span></div>}<div className="owner-work-actions">{work.status === "published" ? <Link href={`/showcase/${work.id}`}>Открыть<ArrowUpRight aria-hidden="true" size={15} /></Link> : <><Link href={`/profile/showcase/${work.id}/edit`}><Pencil aria-hidden="true" size={15} />Редактировать</Link>{["draft", "rejected"].includes(work.status) && <form action={submitShowcaseWorkFormAction.bind(null, work.id)}><button className="link-button"><Send aria-hidden="true" size={15} />На модерацию</button></form>}<form action={deleteShowcaseWorkFormAction.bind(null, work.id)}><ConfirmButton message="Удалить эту неопубликованную работу?">Удалить</ConfirmButton></form></>}</div></div></article>; })}</div> : <div className="portfolio-empty owner-empty"><p>Добавьте самостоятельную работу или принятую работу из задания.</p><Link href="/profile/showcase/new">Добавить первую работу</Link></div>}
      </section>

      <section className="own-profile-section"><div className="portfolio-section-heading"><div><p className="eyebrow">Обучение</p><h2>Курсы</h2></div><BookOpen aria-hidden="true" size={22} /></div><div className="profile-course-list">{(enrollmentRows ?? []).length ? (enrollmentRows ?? []).map((enrollment) => { const course = enrollment.course[0]; if (!course) return null; const cover = getCourseCoverUrl(course.cover_path); return <article className="profile-course-item" key={enrollment.id}><div className="profile-course-cover">{cover ? <Image src={cover} alt="" fill sizes="92px" /> : <div className="cover-placeholder">T</div>}</div><div><span>{enrollment.status === "completed" ? "Завершён" : "Активный"}</span><strong>{course.title}</strong></div><Link href={enrollment.status === "completed" ? `/learn/${course.slug}/complete` : `/learn/${course.slug}`} aria-label={`Открыть курс «${course.title}»`}><ArrowUpRight aria-hidden="true" size={18} /></Link></article>; }) : <p className="portfolio-empty">Курсов пока нет.</p>}</div></section>

      <section className="own-profile-section"><div className="portfolio-section-heading"><div><p className="eyebrow">Достижения</p><h2>Сертификаты</h2></div><Award aria-hidden="true" size={22} /></div><div className="profile-certificate-list">{certificates.length ? certificates.map((certificate) => <CertificateCard certificate={certificate} variant="profile" key={certificate.id} />) : <p className="portfolio-empty">Сертификаты появятся после полного завершения курсов.</p>}</div></section>
    </main>
  );
}

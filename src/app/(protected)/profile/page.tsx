import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/avatar-upload";
import { CertificateCard } from "@/components/certificate-card";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/auth";
import { getCertificateDownloadUrl } from "@/lib/certificates";
import {
  ensureMyProfile,
  getMyProfile,
  isProfileComplete,
  type Topic,
} from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, user.id);

  if (!profile || !isProfileComplete(profile)) {
    redirect("/onboarding");
  }

  const [{ data: topics, error: topicsError }, { data: selected }, { data: certificateRows }] =
    await Promise.all([
      supabase.from("topics").select("id, name, slug").order("name"),
      supabase
        .from("profile_topics")
        .select("topic_id")
        .eq("profile_id", user.id),
      supabase
        .from("certificates")
        .select("id,certificate_code,issued_at,pdf_path,enrollment:enrollments!inner(user_id,course:courses(title))")
        .eq("enrollment.user_id", user.id)
        .order("issued_at", { ascending: false }),
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
    downloadUrl: await getCertificateDownloadUrl(supabase, certificate.pdf_path),
  })));

  return (
    <main className="page-shell profile-shell">
      <section className="profile-summary card">
        <AvatarUpload
          userId={user.id}
          currentPath={profile.avatar_path}
          displayName={profile.display_name}
        />
        <div className="stack compact">
          <p className="eyebrow">Ваш профиль</p>
          <h1>{profile.display_name}</h1>
          <p className="handle">@{profile.username}</p>
          <p className="muted">
            {profile.is_public ? "Публичный профиль" : "Приватный профиль"} · {profile.role}
          </p>
          {profile.is_public && (
            <Link href={`/students/${profile.username}`}>
              Открыть публичную страницу
            </Link>
          )}
        </div>
      </section>

      <section className="card stack">
        <div>
          <p className="eyebrow">Достижения</p>
          <h2>Сертификаты</h2>
        </div>
        {certificates.length
          ? certificates.map((certificate) => <CertificateCard certificate={certificate} key={certificate.id} />)
          : <p className="muted">Сертификаты появятся после полного завершения курсов.</p>}
      </section>

      <section className="card stack roomy">
        <div>
          <p className="eyebrow">Настройки</p>
          <h2>Редактирование профиля</h2>
        </div>
        <ProfileForm
          profile={profile}
          topics={(topics ?? []) as Topic[]}
          selectedTopicIds={(selected ?? []).map((item) => item.topic_id)}
          mode="edit"
        />
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/avatar-upload";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/auth";
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

  const [{ data: topics, error: topicsError }, { data: selected }] =
    await Promise.all([
      supabase.from("topics").select("id, name, slug").order("name"),
      supabase
        .from("profile_topics")
        .select("topic_id")
        .eq("profile_id", user.id),
    ]);

  if (topicsError) {
    throw new Error("Topics unavailable");
  }

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

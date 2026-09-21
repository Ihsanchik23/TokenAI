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

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();
  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, user.id);

  if (!profile) {
    throw new Error("Profile unavailable");
  }

  if (isProfileComplete(profile)) {
    redirect("/profile");
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
    <main className="page-shell narrow-shell">
      <section className="card stack roomy">
        <div>
          <p className="eyebrow">Первый шаг</p>
          <h1>Настройте профиль</h1>
          <p className="muted">
            Имя и username обязательны. Остальное можно изменить позже.
          </p>
        </div>
        <AvatarUpload
          userId={user.id}
          currentPath={profile.avatar_path}
          displayName={profile.display_name}
        />
        <ProfileForm
          profile={profile}
          topics={(topics ?? []) as Topic[]}
          selectedTopicIds={(selected ?? []).map((item) => item.topic_id)}
          mode="onboarding"
        />
      </section>
    </main>
  );
}

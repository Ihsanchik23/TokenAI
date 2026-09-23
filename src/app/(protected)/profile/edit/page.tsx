import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AvatarUpload } from "@/components/avatar-upload";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/auth";
import { ensureMyProfile, getMyProfile, isProfileComplete, type Topic } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function EditProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, user.id);
  if (!profile || !isProfileComplete(profile)) redirect("/onboarding");

  const [{ data: topics, error: topicsError }, { data: selected }] = await Promise.all([
    supabase.from("topics").select("id,name,slug").order("name"),
    supabase.from("profile_topics").select("topic_id").eq("profile_id", user.id),
  ]);
  if (topicsError) throw new Error("Topics unavailable");

  return (
    <main className="page-shell profile-edit-page">
      <Link className="profile-edit-back" href="/profile"><ArrowLeft aria-hidden="true" size={17} />Ваш профиль</Link>
      <header className="profile-edit-heading"><p className="eyebrow">Настройки</p><h1>Редактировать профиль</h1></header>
      <section className="profile-edit-layout">
        <AvatarUpload userId={user.id} currentPath={profile.avatar_path} displayName={profile.display_name} iconOnly />
        <ProfileForm profile={profile} topics={(topics ?? []) as Topic[]} selectedTopicIds={(selected ?? []).map((item) => item.topic_id)} mode="edit" />
      </section>
    </main>
  );
}

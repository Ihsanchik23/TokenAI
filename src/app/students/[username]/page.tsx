import Image from "next/image";
import { notFound } from "next/navigation";
import type { Profile, Topic } from "@/lib/profile";
import { getAvatarUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export default async function PublicProfilePage({
  params,
}: PageProps<"/students/[username]">) {
  const { username } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_path, is_public, role, created_at",
    )
    .eq("username", username.toLowerCase())
    .eq("is_public", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const profile = data as Profile;
  const { data: links } = await supabase
    .from("profile_topics")
    .select("topic_id")
    .eq("profile_id", profile.id);
  const topicIds = (links ?? []).map((item) => item.topic_id);
  const topicsResult = topicIds.length
    ? await supabase
        .from("topics")
        .select("id, name, slug")
        .in("id", topicIds)
        .order("name")
    : { data: [] };
  const topics = (topicsResult.data ?? []) as Topic[];
  const avatarUrl = getAvatarUrl(profile.avatar_path);

  return (
    <main className="page-shell profile-shell">
      <section className="card public-profile-header">
        <div className="avatar avatar-large">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={`Аватар ${profile.display_name ?? profile.username}`}
              width={112}
              height={112}
              unoptimized
            />
          ) : (
            <span>
              {(profile.display_name ?? profile.username).charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="stack compact">
          <p className="eyebrow">Участник TokenAI</p>
          <h1>{profile.display_name ?? profile.username}</h1>
          <p className="handle">@{profile.username}</p>
          {profile.bio && <p>{profile.bio}</p>}
        </div>
      </section>

      <section className="card stack">
        <h2>Интересы</h2>
        {topics.length > 0 ? (
          <div className="tag-list">
            {topics.map((topic) => (
              <span className="tag" key={topic.id}>{topic.name}</span>
            ))}
          </div>
        ) : (
          <p className="muted">Интересы пока не выбраны.</p>
        )}
      </section>

      <section className="placeholder-grid">
        {[
          ["Курсы", "Здесь появятся пройденные курсы."],
          ["Сертификаты", "Сертификатов пока нет."],
          ["Работы", "Публичные работы появятся позже."],
        ].map(([title, description]) => (
          <div className="card stack compact" key={title}>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

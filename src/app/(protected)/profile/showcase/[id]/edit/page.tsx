import { notFound } from "next/navigation";
import { ShowcaseWorkForm, type EditableShowcaseWork } from "@/components/showcase-work-form";
import { requireUser } from "@/lib/auth";
import { getShowcaseCoverUrls, type PublicTopic } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditShowcaseWorkPage({ params }: PageProps<"/profile/showcase/[id]/edit">) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  if (!uuidPattern.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: work }, { data: topics }] = await Promise.all([
    supabase.from("showcase_works").select("id,topic_id,source_submission_id,title,description,cover_path,external_url,status,moderation_comment").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("topics").select("id,name,slug").order("name"),
  ]);
  if (!work || !["draft", "pending", "rejected"].includes(work.status)) notFound();
  const covers = await getShowcaseCoverUrls(supabase, [work.cover_path]);
  return <main className="page-shell narrow-content stack roomy"><header className="stack compact"><p className="eyebrow">Showcase</p><h1>Редактировать работу</h1><p className="muted">Статус: {work.status}</p></header><ShowcaseWorkForm userId={user.id} topics={(topics ?? []) as PublicTopic[]} work={work as EditableShowcaseWork} currentCoverUrl={work.cover_path ? covers.get(work.cover_path) ?? null : null} /></main>;
}

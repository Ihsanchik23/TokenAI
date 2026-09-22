import { notFound, redirect } from "next/navigation";
import { ShowcaseWorkForm } from "@/components/showcase-work-form";
import { requireUser } from "@/lib/auth";
import type { PublicTopic } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SourceRow = { id: string; assignment: Array<{ lesson: Array<{ title: string }> }> };

export default async function NewShowcaseWorkPage({ searchParams }: PageProps<"/profile/showcase/new">) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const sourceId = typeof query.submission === "string" ? query.submission : null;
  if (sourceId && !uuidPattern.test(sourceId)) notFound();
  const supabase = await createClient();
  const { data: topics } = await supabase.from("topics").select("id,name,slug").order("name");
  let sourceTitle: string | null = null;
  if (sourceId) {
    const [{ data: source }, { data: existing }] = await Promise.all([
      supabase.from("assignment_submissions").select("id,assignment:assignments(lesson:lessons(title))").eq("id", sourceId).eq("user_id", user.id).eq("status", "approved").maybeSingle(),
      supabase.from("showcase_works").select("id").eq("source_submission_id", sourceId).maybeSingle(),
    ]);
    if (existing?.id) redirect(`/profile/showcase/${existing.id}/edit`);
    if (!source) notFound();
    const typedSource = source as unknown as SourceRow;
    sourceTitle = typedSource.assignment[0]?.lesson[0]?.title ?? "Принятое задание";
  }

  return <main className="page-shell narrow-content stack roomy"><header className="stack compact"><p className="eyebrow">Showcase</p><h1>Добавить работу</h1><p className="muted">Сохраните черновик или отправьте работу на модерацию.</p></header><ShowcaseWorkForm userId={user.id} topics={(topics ?? []) as PublicTopic[]} sourceSubmissionId={sourceId} sourceTitle={sourceTitle} /></main>;
}

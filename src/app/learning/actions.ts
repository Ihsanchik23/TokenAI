"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { preparePendingCertificatesForUser } from "@/lib/certificates";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function startLessonAction(lessonId: string) {
  await requireUser();
  if (!uuidPattern.test(lessonId)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_lesson", { target_lesson_id: lessonId });
  return { ok: !error };
}

export async function completeTheoryLessonAction(courseSlug: string, lessonId: string) {
  const user = await requireUser();
  if (!slugPattern.test(courseSlug) || !uuidPattern.test(lessonId)) redirect("/my-courses");
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_theory_lesson", { target_lesson_id: lessonId });
  if (error) redirect(`/learn/${courseSlug}/${lessonId}?error=complete-failed`);
  await preparePendingCertificatesForUser(supabase, user.id);
  revalidatePath("/my-courses");
  revalidatePath(`/learn/${courseSlug}`);
  redirect(`/learn/${courseSlug}`);
}

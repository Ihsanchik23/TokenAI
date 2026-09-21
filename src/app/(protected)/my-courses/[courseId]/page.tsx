import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEnrollment } from "@/lib/enrollments";
import { createClient } from "@/lib/supabase/server";

export default async function LegacyCoursePlayerRoute({ params }: { params: Promise<{ courseId: string }> }) {
  const [{ courseId }, user] = await Promise.all([params, requireUser()]);
  const enrollment = await getEnrollment(user.id, courseId);
  if (!enrollment) notFound();
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("slug").eq("id", courseId).maybeSingle();
  if (!course) notFound();
  redirect(`/learn/${course.slug}`);
}

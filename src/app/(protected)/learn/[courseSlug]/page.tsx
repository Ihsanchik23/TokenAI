import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLearningState } from "@/lib/learning";

export default async function ContinueCoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const [{ courseSlug }, user] = await Promise.all([params, requireUser()]);
  const state = await getLearningState(courseSlug, user.id);
  if (!state) notFound();
  if (state.learningComplete || state.curriculumComplete) redirect(`/learn/${courseSlug}/complete`);
  if (!state.continueLesson) redirect(`/learn/${courseSlug}/complete`);
  redirect(`/learn/${courseSlug}/${state.continueLesson.id}`);
}

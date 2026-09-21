import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLearningState } from "@/lib/learning";

export default async function LearningCompletePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const [{ courseSlug }, user] = await Promise.all([params, requireUser()]);
  const state = await getLearningState(courseSlug, user.id);
  if (!state) notFound();
  if (!state.learningComplete) redirect(`/learn/${courseSlug}`);
  return <main className="page-shell narrow-shell"><section className="card stack center"><p className="eyebrow">100% программы</p><h1>Обучение завершено</h1><p className="muted">Все обязательные уроки курса «{state.course.title}» пройдены. Enrollment остаётся активным до появления правил итоговой аттестации.</p><Link className="button" href="/my-courses">Вернуться к моим курсам</Link></section></main>;
}

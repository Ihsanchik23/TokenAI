import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Award, Check, Clock3 } from "lucide-react";
import { CertificateCard } from "@/components/certificate-card";
import { requireUser } from "@/lib/auth";
import { ensureCertificatePdf, getCertificateDownloadUrl } from "@/lib/certificates";
import { getLearningState } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";

export default async function LearningCompletePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const [{ courseSlug }, user] = await Promise.all([params, requireUser()]);
  const state = await getLearningState(courseSlug, user.id);
  if (!state) notFound();
  if (!state.curriculumComplete) redirect(`/learn/${courseSlug}`);

  const supabase = await createClient();
  let certificate = null;
  if (state.completion?.certificateId) {
    await ensureCertificatePdf(supabase, state.completion.certificateId);
    const { data } = await supabase
      .from("certificates")
      .select("id,certificate_code,issued_at,pdf_path")
      .eq("id", state.completion.certificateId)
      .maybeSingle();
    if (data) {
      certificate = {
        ...data,
        courseTitle: state.course.title,
        downloadUrl: await getCertificateDownloadUrl(supabase, data.pdf_path),
      };
    }
  }

  const pendingApproval = !state.learningComplete && (state.completion?.missingAssignments ?? 0) > 0;
  return (
    <main className="page-shell completion-page">
      <section className="completion-panel">
        <div className={`completion-mark${state.learningComplete ? " complete" : ""}`}>{state.learningComplete ? <Check aria-hidden="true" size={42} /> : <Clock3 aria-hidden="true" size={38} />}</div>
        <p className="eyebrow">{state.learningComplete ? "Курс завершён" : "100% программы"}</p>
        <h1>{state.learningComplete ? "Курс пройден." : "Материалы пройдены"}</h1>
        {state.learningComplete ? (
          <p className="completion-lead">Вы выполнили все обязательные условия курса «{state.course.title}».</p>
        ) : pendingApproval ? (
          <p className="notice">Все уроки пройдены. Финальное завершение и сертификат появятся после одобрения {state.completion?.missingAssignments} заданий.</p>
        ) : (
          <p className="notice">Для завершения курса отправьте обязательные тесты и задания.</p>
        )}
        {state.completion?.completedAt && <p className="completion-date"><Check aria-hidden="true" size={17} />Завершено {new Date(state.completion.completedAt).toLocaleDateString("ru-RU")}</p>}
        {certificate && <div className="completion-certificate"><Award aria-hidden="true" size={24} /><CertificateCard certificate={certificate} /></div>}
        <Link className="button secondary" href="/my-courses">Вернуться к моим курсам<ArrowRight aria-hidden="true" size={18} /></Link>
      </section>
    </main>
  );
}

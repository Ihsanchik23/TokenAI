import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
    <main className="page-shell narrow-shell">
      <section className="card stack center roomy">
        <p className="eyebrow">{state.learningComplete ? "Курс завершён" : "100% программы"}</p>
        <h1>{state.learningComplete ? "Поздравляем!" : "Материалы пройдены"}</h1>
        {state.learningComplete ? (
          <p className="muted">Вы выполнили все обязательные условия курса «{state.course.title}».</p>
        ) : pendingApproval ? (
          <p className="notice">Все уроки пройдены. Финальное завершение и сертификат появятся после одобрения {state.completion?.missingAssignments} заданий.</p>
        ) : (
          <p className="notice">Для завершения курса отправьте обязательные тесты и задания.</p>
        )}
        {certificate && <CertificateCard certificate={certificate} />}
        <Link className="button" href="/my-courses">Вернуться к моим курсам</Link>
      </section>
    </main>
  );
}

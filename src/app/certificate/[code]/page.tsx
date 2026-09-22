import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type VerifiedCertificate = {
  valid: true;
  code: string;
  studentName: string;
  courseTitle: string;
  completedAt: string;
  issuedAt: string;
};

const codePattern = /^TKN-[A-F0-9]{12}$/;

export default async function CertificateVerificationPage({ params }: PageProps<"/certificate/[code]">) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  if (!codePattern.test(code)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_certificate", { target_code: code });
  if (error || !data) notFound();
  const certificate = data as VerifiedCertificate;

  return (
    <main className="page-shell narrow-shell">
      <section className="card stack center roomy">
        <p className="eyebrow">Сертификат подтверждён</p>
        <h1>TokenAI Certificate</h1>
        <div className="stack compact">
          <p className="muted">Студент</p>
          <h2>{certificate.studentName}</h2>
          <p className="muted">Курс</p>
          <h2>{certificate.courseTitle}</h2>
        </div>
        <p>Завершён {new Date(certificate.completedAt).toLocaleDateString("ru-RU")}</p>
        <p className="certificate-code">{certificate.code}</p>
        <Link href="/courses">Каталог TokenAI</Link>
      </section>
    </main>
  );
}

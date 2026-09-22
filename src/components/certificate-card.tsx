import Link from "next/link";
import { prepareCertificatePdfAction } from "@/app/certificate-actions";

export type CertificateCardData = {
  id: string;
  certificate_code: string;
  issued_at: string;
  pdf_path: string | null;
  downloadUrl: string | null;
  courseTitle?: string;
};

export function CertificateCard({ certificate }: { certificate: CertificateCardData }) {
  return (
    <article className="certificate-card stack compact">
      <div>
        {certificate.courseTitle && <strong>{certificate.courseTitle}</strong>}
        <p className="muted">Сертификат {certificate.certificate_code}</p>
        <small className="field-help">
          Выдан {new Date(certificate.issued_at).toLocaleDateString("ru-RU")}
        </small>
      </div>
      <div className="actions">
        <Link href={`/certificate/${certificate.certificate_code}`}>Проверить</Link>
        {certificate.downloadUrl ? (
          <a href={certificate.downloadUrl} target="_blank" rel="noreferrer">Скачать PDF</a>
        ) : (
          <form action={prepareCertificatePdfAction.bind(null, certificate.id)}>
            <button className="link-button" type="submit">Подготовить PDF</button>
          </form>
        )}
      </div>
    </article>
  );
}

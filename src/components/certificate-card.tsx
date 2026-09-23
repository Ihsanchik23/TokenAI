import Image from "next/image";
import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { prepareCertificatePdfAction } from "@/app/certificate-actions";

export type CertificateCardData = {
  id: string;
  certificate_code: string;
  issued_at: string;
  pdf_path: string | null;
  downloadUrl: string | null;
  courseTitle?: string;
  courseCoverUrl?: string | null;
};

export function CertificateCard({ certificate, variant = "default" }: { certificate: CertificateCardData; variant?: "default" | "profile" }) {
  if (variant === "profile") {
    return (
      <article className="profile-certificate-row">
        <div className="profile-certificate-cover">{certificate.courseCoverUrl ? <Image src={certificate.courseCoverUrl} alt="" fill sizes="96px" /> : <div className="cover-placeholder">T</div>}</div>
        <strong>{certificate.courseTitle}</strong>
        <div className="profile-certificate-actions">
          <Link href={`/certificate/${certificate.certificate_code}`}><ShieldCheck aria-hidden="true" size={16} />Проверить</Link>
          {certificate.downloadUrl ? <a href={certificate.downloadUrl} target="_blank" rel="noreferrer"><Download aria-hidden="true" size={16} />Скачать PDF</a> : <form action={prepareCertificatePdfAction.bind(null, certificate.id)}><button className="link-button" type="submit"><Download aria-hidden="true" size={16} />Скачать PDF</button></form>}
        </div>
      </article>
    );
  }

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

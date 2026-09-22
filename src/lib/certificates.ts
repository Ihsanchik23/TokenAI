import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, PDFFont, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseCompletion = {
  enrollmentId: string;
  status: "active" | "completed" | "cancelled";
  requiredTotal: number;
  completedRequired: number;
  missingQuizzes: number;
  missingAssignments: number;
  progressPercent: number;
  fullyCompleted: boolean;
  newlyCompleted: boolean;
  completedAt: string | null;
  certificateId: string | null;
  certificateCode: string | null;
  certificatePdfPath: string | null;
};

type CertificateDocumentData = {
  id: string;
  code: string;
  issuedAt: string;
  pdfPath: string | null;
  ownerId: string;
  studentName: string;
  courseTitle: string;
  completedAt: string;
  instructorNames: string[];
};

function centeredText(page: PDFPage, font: PDFFont, text: string, y: number, size: number) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: Math.max(42, (page.getWidth() - width) / 2),
    y,
    size,
    font,
    color: rgb(0.11, 0.12, 0.18),
  });
}

function fitText(font: PDFFont, text: string, maxWidth: number, preferredSize: number) {
  let size = preferredSize;
  while (size > 15 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

async function createCertificatePdf(data: CertificateDocumentData) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const fontBytes = await readFile(
    path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
  );
  const font = await document.embedFont(fontBytes, { subset: true });
  const page = document.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  document.setTitle(`TokenAI — ${data.courseTitle}`);
  document.setAuthor("TokenAI");
  document.setSubject(`Certificate ${data.code}`);

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderWidth: 3, borderColor: rgb(0.36, 0.31, 0.91) });
  page.drawRectangle({ x: 36, y: 36, width: width - 72, height: height - 72, borderWidth: 1, borderColor: rgb(0.82, 0.83, 0.9) });
  centeredText(page, font, "TOKENAI", height - 92, 20);
  centeredText(page, font, "СЕРТИФИКАТ ОБ ОКОНЧАНИИ КУРСА", height - 144, 27);
  centeredText(page, font, "Настоящим подтверждается, что", height - 202, 15);
  centeredText(page, font, data.studentName, height - 254, fitText(font, data.studentName, width - 120, 34));
  centeredText(page, font, "успешно завершил(а) курс", height - 300, 15);
  centeredText(page, font, data.courseTitle, height - 350, fitText(font, data.courseTitle, width - 120, 29));

  const completionDate = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(data.completedAt));
  centeredText(page, font, `Дата завершения: ${completionDate}`, height - 410, 13);
  if (data.instructorNames.length) {
    centeredText(page, font, `Преподаватели: ${data.instructorNames.join(", ")}`, height - 442, 12);
  }
  centeredText(page, font, `Код проверки: ${data.code}`, 76, 12);
  const verificationUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tokenai.kz").replace(/\/$/, "")}/certificate/${data.code}`;
  centeredText(page, font, verificationUrl, 54, fitText(font, verificationUrl, width - 120, 10));

  return document.save();
}

export async function evaluateCourseCompletion(
  supabase: SupabaseClient,
  enrollmentId: string,
): Promise<CourseCompletion | null> {
  const { data, error } = await supabase.rpc("evaluate_course_completion", {
    target_enrollment_id: enrollmentId,
  });
  if (error || !data) return null;
  return data as CourseCompletion;
}

export async function ensureCertificatePdf(
  supabase: SupabaseClient,
  certificateId: string,
): Promise<{ ok: boolean; path: string | null }> {
  const { data, error } = await supabase.rpc("get_certificate_document_data", {
    target_certificate_id: certificateId,
  });
  if (error || !data) return { ok: false, path: null };

  const certificate = data as CertificateDocumentData;
  if (certificate.pdfPath) return { ok: true, path: certificate.pdfPath };

  const objectPath = `${certificate.ownerId}/${certificate.id}.pdf`;
  const { data: existing } = await supabase.storage
    .from("certificates")
    .list(certificate.ownerId, { search: `${certificate.id}.pdf`, limit: 1 });

  if (!existing?.some((object) => object.name === `${certificate.id}.pdf`)) {
    try {
      const pdf = await createCertificatePdf(certificate);
      const { error: uploadError } = await supabase.storage
        .from("certificates")
        .upload(objectPath, pdf, { contentType: "application/pdf", upsert: false });
      if (uploadError && uploadError.statusCode !== "409") return { ok: false, path: null };
    } catch {
      return { ok: false, path: null };
    }
  }

  const { data: registeredPath, error: registerError } = await supabase.rpc(
    "register_certificate_pdf",
    { target_certificate_id: certificate.id },
  );
  if (registerError || typeof registeredPath !== "string") return { ok: false, path: null };
  return { ok: true, path: registeredPath };
}

export async function prepareCertificateForEnrollment(
  supabase: SupabaseClient,
  enrollmentId: string,
) {
  const completion = await evaluateCourseCompletion(supabase, enrollmentId);
  if (!completion?.certificateId) return completion;
  await ensureCertificatePdf(supabase, completion.certificateId);
  return completion;
}

export async function preparePendingCertificatesForUser(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data } = await supabase
    .from("certificates")
    .select("id,enrollment:enrollments!inner(user_id,status)")
    .eq("enrollment.user_id", userId)
    .eq("enrollment.status", "completed")
    .is("pdf_path", null)
    .limit(3);

  await Promise.all((data ?? []).map((certificate) => ensureCertificatePdf(supabase, certificate.id)));
}

export async function getCertificateDownloadUrl(
  supabase: SupabaseClient,
  pdfPath: string | null,
) {
  if (!pdfPath) return null;
  const { data, error } = await supabase.storage.from("certificates").createSignedUrl(pdfPath, 3600);
  return error ? null : data.signedUrl;
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitAssignmentAction } from "@/app/learning/assignment-actions";
import {
  assignmentFileTypes,
  maxAssignmentFileSize,
  maxAssignmentFiles,
  type AssignmentLessonData,
  type UploadedAssignmentFile,
} from "@/lib/assignments";
import { createClient } from "@/lib/supabase/client";

const statusLabels = { submitted: "На проверке", approved: "Принято", needs_revision: "Нужна доработка" };

function safeFileName(name: string) {
  const cleaned = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(-120) || "file";
}

function formatBytes(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} МБ` : `${Math.ceil(size / 1024)} КБ`;
}

export function AssignmentLesson({ userId, data }: { userId: string; data: AssignmentLessonData }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const latest = data.submissions[0] ?? null;
  const canSubmit = !latest || (data.allowResubmission && latest.status === "needs_revision");

  async function submit(formData: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setUploading(true);
    setMessage(null);
    const text = String(formData.get("text") ?? "").trim();
    const link = String(formData.get("link") ?? "").trim();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length > maxAssignmentFiles) {
      setMessage(`Можно прикрепить не более ${maxAssignmentFiles} файлов.`);
      submittingRef.current = false;
      setUploading(false);
      return;
    }
    if (files.some((file) => !assignmentFileTypes.includes(file.type as typeof assignmentFileTypes[number]) || file.size > maxAssignmentFileSize)) {
      setMessage("Разрешены PDF, TXT, DOC/DOCX, JPG, PNG, WebP или ZIP до 10 МБ каждый.");
      submittingRef.current = false;
      setUploading(false);
      return;
    }
    if (!text && !link && files.length === 0) {
      setMessage("Добавьте текст, ссылку или файл.");
      submittingRef.current = false;
      setUploading(false);
      return;
    }
    if (link) {
      try {
        const url = new URL(link);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        setMessage("Укажите корректную ссылку с http:// или https://.");
        submittingRef.current = false;
        setUploading(false);
        return;
      }
    }

    const token = crypto.randomUUID();
    const supabase = createClient();
    const uploaded: UploadedAssignmentFile[] = [];
    for (const [index, file] of files.entries()) {
      const path = `${userId}/${data.assignmentId}/${token}/${index + 1}-${safeFileName(file.name)}`;
      const result = await supabase.storage.from("submission-files").upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) {
        if (uploaded.length) await supabase.storage.from("submission-files").remove(uploaded.map((item) => item.path));
        setMessage("Не удалось загрузить один из файлов. Попробуйте ещё раз.");
        submittingRef.current = false;
        setUploading(false);
        return;
      }
      uploaded.push({ path, name: file.name.slice(0, 255) });
    }

    setUploading(false);
    startTransition(async () => {
      try {
        const result = await submitAssignmentAction({ assignmentId: data.assignmentId, requestToken: token, text, link, files: uploaded });
        setMessage(result.message);
        if (result.ok) {
          formRef.current?.reset();
          router.refresh();
        }
      } catch {
        if (uploaded.length) await supabase.storage.from("submission-files").remove(uploaded.map((item) => item.path));
        setMessage("Связь прервалась. Обновите страницу, чтобы проверить статус отправки.");
      } finally {
        submittingRef.current = false;
      }
    });
  }

  return <div className="stack roomy">
    <section className="stack compact"><h3>Инструкция</h3><div className="lesson-content">{data.instructions}</div><p className="field-help">Можно отправить: {[data.allowText && "текст", data.allowLink && "ссылку", data.allowFile && "файлы"].filter(Boolean).join(", ")}.</p></section>

    {canSubmit ? <form ref={formRef} className="stack" action={(formData) => void submit(formData)}>
      {data.allowText && <label className="field"><span>Ответ</span><textarea name="text" rows={7} maxLength={10000} /></label>}
      {data.allowLink && <label className="field"><span>Ссылка</span><input name="link" type="url" maxLength={2000} placeholder="https://…" /></label>}
      {data.allowFile && <label className="field"><span>Файлы</span><input name="files" type="file" multiple accept={assignmentFileTypes.join(",")} /><small className="field-help">До 5 файлов, каждый до 10 МБ: PDF, TXT, DOC/DOCX, изображения или ZIP.</small></label>}
      {message && <p className={message.includes("отправлена") ? "notice success" : "notice"} aria-live="polite">{message}</p>}
      <button className="button" disabled={pending || uploading}>{uploading ? "Загружаем файлы…" : pending ? "Отправляем…" : latest ? "Отправить новую попытку" : "Отправить работу"}</button>
    </form> : <p className={latest?.status === "approved" ? "notice success" : "notice"}>{latest?.status === "approved" ? "Работа принята преподавателем." : "Работа отправлена и ожидает проверки."}</p>}

    {data.submissions.length > 0 && <section className="stack"><h3>История отправок</h3>{data.submissions.map((submission) => <article className="quiz-question stack compact" key={submission.id}><div className="actions split"><strong>Попытка {submission.attemptNumber}</strong><span className={`badge ${submission.status}`}>{statusLabels[submission.status]}</span></div><p className="field-help">{new Date(submission.submittedAt).toLocaleString("ru-RU")}</p>{submission.textAnswer && <p>{submission.textAnswer}</p>}{submission.linkUrl && <a href={submission.linkUrl} target="_blank" rel="noreferrer">Открыть ссылку ↗</a>}{submission.files.map((file) => <a href={file.signedUrl ?? "#"} target="_blank" rel="noreferrer" key={file.id}>{file.name} · {formatBytes(file.size)}</a>)}{submission.teacherComment && <p className="notice"><strong>Комментарий преподавателя:</strong> {submission.teacherComment}</p>}</article>)}</section>}
  </div>;
}

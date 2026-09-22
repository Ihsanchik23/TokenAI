"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, ExternalLink, FileText, Link2, MessageSquareText, Paperclip, RotateCcw, Send } from "lucide-react";
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
const statusIcons = { submitted: Clock3, approved: CheckCircle2, needs_revision: RotateCcw };

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

  return <div className="assignment-shell">
    <section className="assignment-instructions"><p className="eyebrow">Практическое задание</p><h2>Инструкция</h2><div className="lesson-content">{data.instructions}</div><div className="submission-types" aria-label="Доступные форматы ответа">{data.allowText && <span><FileText aria-hidden="true" size={16} />Текст</span>}{data.allowLink && <span><Link2 aria-hidden="true" size={16} />Ссылка</span>}{data.allowFile && <span><Paperclip aria-hidden="true" size={16} />Файлы</span>}</div></section>

    {canSubmit ? <form ref={formRef} className="assignment-form" action={(formData) => void submit(formData)}>
      <div><p className="eyebrow">Ваш ответ</p><h2>{latest ? "Новая попытка" : "Отправить работу"}</h2></div>
      {data.allowText && <label className="field"><span>Текст ответа</span><textarea name="text" rows={7} maxLength={10000} placeholder="Опишите результат или ход работы" /></label>}
      {data.allowLink && <label className="field"><span>Ссылка</span><input name="link" type="url" maxLength={2000} placeholder="https://…" /></label>}
      {data.allowFile && <label className="field file-field"><span><Paperclip aria-hidden="true" size={17} />Файлы</span><input name="files" type="file" multiple accept={assignmentFileTypes.join(",")} /><small className="field-help">До 5 файлов, каждый до 10 МБ: PDF, TXT, DOC/DOCX, изображения или ZIP.</small></label>}
      {message && <p className={message.includes("отправлена") ? "notice success" : "notice"} aria-live="polite">{message}</p>}
      <button className="button" disabled={pending || uploading}><Send aria-hidden="true" size={18} />{uploading ? "Загружаем файлы…" : pending ? "Отправляем…" : latest ? "Отправить новую попытку" : "Отправить работу"}</button>
    </form> : <div className={`assignment-current-state ${latest?.status ?? "submitted"}`}>{latest?.status === "approved" ? <CheckCircle2 aria-hidden="true" size={24} /> : <Clock3 aria-hidden="true" size={24} />}<div><strong>{latest?.status === "approved" ? "Работа принята" : "Работа на проверке"}</strong><p>{latest?.status === "approved" ? "Преподаватель одобрил эту попытку." : "Новая отправка станет доступна, если преподаватель вернёт работу на доработку."}</p></div></div>}

    {data.submissions.length > 0 && <section className="assignment-history"><div><p className="eyebrow">Отправки</p><h2>История попыток</h2></div>{data.submissions.map((submission) => { const StatusIcon = statusIcons[submission.status]; return <article className="submission-item" key={submission.id}><header><div><strong>Попытка {submission.attemptNumber}</strong><time>{new Date(submission.submittedAt).toLocaleString("ru-RU")}</time></div><span className={`status-pill ${submission.status}`}><StatusIcon aria-hidden="true" size={15} />{statusLabels[submission.status]}</span></header>{submission.textAnswer && <p className="submission-answer">{submission.textAnswer}</p>}<div className="submission-links">{submission.linkUrl && <a href={submission.linkUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" size={16} />Открыть ссылку</a>}{submission.files.map((file) => <a href={file.signedUrl ?? "#"} target="_blank" rel="noreferrer" key={file.id}><Paperclip aria-hidden="true" size={16} />{file.name} · {formatBytes(file.size)}</a>)}</div>{submission.teacherComment && <div className="teacher-comment"><MessageSquareText aria-hidden="true" size={19} /><p><strong>Комментарий преподавателя</strong><span>{submission.teacherComment}</span></p></div>}{submission.status === "approved" && <Link className="showcase-action" href={`/profile/showcase/new?submission=${submission.id}`}>Добавить в Showcase</Link>}</article>; })}</section>}
  </div>;
}

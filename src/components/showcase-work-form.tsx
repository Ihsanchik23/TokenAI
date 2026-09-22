"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock3, ImagePlus, Save, Send } from "lucide-react";
import { saveShowcaseWorkAction } from "@/app/showcase/actions";
import type { PublicTopic } from "@/lib/showcase";
import { createClient } from "@/lib/supabase/client";

const maxCoverSize = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type EditableShowcaseWork = {
  id: string;
  topic_id: string;
  source_submission_id: string | null;
  title: string;
  description: string | null;
  cover_path: string | null;
  external_url: string | null;
  status: "draft" | "pending" | "rejected";
  moderation_comment: string | null;
};

export function ShowcaseWorkForm({
  userId,
  topics,
  work,
  sourceSubmissionId,
  sourceTitle,
  currentCoverUrl,
}: {
  userId: string;
  topics: PublicTopic[];
  work?: EditableShowcaseWork;
  sourceSubmissionId?: string | null;
  sourceTitle?: string | null;
  currentCoverUrl?: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function save(formData: FormData) {
    const submit = formData.get("intent") === "submit";
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const externalUrl = String(formData.get("externalUrl") ?? "").trim();
    const topicId = String(formData.get("topicId") ?? "");
    const removeCover = formData.get("removeCover") === "on";
    const fileValue = formData.get("cover");
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    let coverPath = removeCover ? null : work?.cover_path ?? null;
    let uploadedPath: string | null = null;

    if (file) {
      const extension = imageExtensions[file.type];
      if (!extension || file.size > maxCoverSize) {
        setMessage("Обложка должна быть JPG, PNG или WebP размером до 5 МБ.");
        return;
      }
      setUploading(true);
      const token = crypto.randomUUID();
      uploadedPath = `${userId}/${work?.id ?? token}/cover-${Date.now()}.${extension}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("showcase-files").upload(uploadedPath, file, { contentType: file.type, upsert: false });
      if (error) {
        setUploading(false);
        setMessage("Не удалось загрузить обложку.");
        return;
      }
      coverPath = uploadedPath;
      setUploading(false);
    }

    startTransition(async () => {
      const result = await saveShowcaseWorkAction({
        id: work?.id ?? null,
        topicId,
        title,
        description,
        coverPath,
        externalUrl,
        sourceSubmissionId: work?.source_submission_id ?? sourceSubmissionId ?? null,
        submit,
      });
      if (!result.ok) {
        if (uploadedPath) await createClient().storage.from("showcase-files").remove([uploadedPath]);
        setMessage(result.message);
        return;
      }
      if (result.oldCoverPath && result.oldCoverPath !== coverPath) {
        await createClient().storage.from("showcase-files").remove([result.oldCoverPath]);
      }
      setMessage(result.message);
      formRef.current?.reset();
      router.push("/profile?showcase=saved");
      router.refresh();
    });
  }

  return (
    <form ref={formRef} className="showcase-editor-form" action={(formData) => void save(formData)}>
      <div className="showcase-editor-media">
        <div className="showcase-editor-preview">
          {previewUrl || currentCoverUrl ? <Image src={previewUrl ?? currentCoverUrl!} alt="Обложка работы" fill sizes="(max-width: 900px) 100vw, 42vw" unoptimized={Boolean(previewUrl)} /> : <div className="showcase-missing-media"><ImagePlus aria-hidden="true" size={34} /><span>Добавьте обложку</span><small>Она станет главным изображением работы</small></div>}
        </div>
        <label className="cover-upload-button"><ImagePlus aria-hidden="true" size={18} /><span>{previewUrl || currentCoverUrl ? "Заменить обложку" : "Выбрать обложку"}</span><input className="visually-hidden" name="cover" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(file ? URL.createObjectURL(file) : null); }} /></label>
        <small className="field-help">JPG, PNG или WebP, до 5 МБ.</small>
        {currentCoverUrl && <label className="remove-cover-toggle"><input name="removeCover" type="checkbox" /><span>Удалить текущую обложку</span></label>}
      </div>

      <div className="showcase-editor-fields">
        <header><div><p className="eyebrow">Showcase</p><h2>{work ? "Редактирование работы" : "Новая работа"}</h2></div><span className={`moderation-status ${work?.status ?? "draft"}`}>{work?.status === "pending" ? <Clock3 aria-hidden="true" size={14} /> : work?.status === "rejected" ? <AlertTriangle aria-hidden="true" size={14} /> : <CheckCircle2 aria-hidden="true" size={14} />}{work?.status === "pending" ? "На модерации" : work?.status === "rejected" ? "Отклонено" : "Черновик"}</span></header>
        {sourceTitle && <p className="source-assignment-note">Работа создаётся из принятого задания: <strong>{sourceTitle}</strong>.</p>}
        {work?.moderation_comment && <div className="moderation-feedback"><AlertTriangle aria-hidden="true" size={20} /><p><strong>Комментарий модератора</strong><span>{work.moderation_comment}</span></p></div>}
        <label className="field"><span>Название</span><input name="title" required minLength={3} maxLength={120} defaultValue={work?.title ?? sourceTitle ?? ""} placeholder="Название проекта" /></label>
        <label className="field"><span>Описание</span><textarea name="description" rows={8} maxLength={5000} defaultValue={work?.description ?? ""} placeholder="Расскажите о работе, процессе и результате" /></label>
        <div className="showcase-form-grid"><label className="field"><span>Категория</span><select name="topicId" required defaultValue={work?.topic_id ?? ""}><option value="" disabled>Выберите тему</option>{topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.name}</option>)}</select></label><label className="field"><span>Ссылка на проект</span><input name="externalUrl" type="url" maxLength={2000} placeholder="https://…" defaultValue={work?.external_url ?? ""} /></label></div>
        {message && <p className="notice" aria-live="polite">{message}</p>}
        <div className="showcase-editor-actions"><button className="button secondary" name="intent" value="draft" disabled={pending || uploading}><Save aria-hidden="true" size={18} />{pending ? "Сохраняем…" : "Сохранить черновик"}</button><button className="button" name="intent" value="submit" disabled={pending || uploading}><Send aria-hidden="true" size={18} />{uploading ? "Загружаем…" : "Отправить на модерацию"}</button></div>
      </div>
    </form>
  );
}

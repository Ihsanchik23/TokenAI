"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
    <form ref={formRef} className="card stack roomy" action={(formData) => void save(formData)}>
      {sourceTitle && <p className="notice">Работа создаётся из принятого задания: <strong>{sourceTitle}</strong>.</p>}
      {work?.moderation_comment && <p className="notice"><strong>Комментарий модератора:</strong> {work.moderation_comment}</p>}
      <label className="field"><span>Название</span><input name="title" required minLength={3} maxLength={120} defaultValue={work?.title ?? sourceTitle ?? ""} /></label>
      <label className="field"><span>Описание</span><textarea name="description" rows={8} maxLength={5000} defaultValue={work?.description ?? ""} /></label>
      <label className="field"><span>Категория</span><select name="topicId" required defaultValue={work?.topic_id ?? ""}><option value="" disabled>Выберите тему</option>{topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.name}</option>)}</select></label>
      <label className="field"><span>Ссылка на проект</span><input name="externalUrl" type="url" maxLength={2000} placeholder="https://…" defaultValue={work?.external_url ?? ""} /></label>
      <label className="field"><span>Обложка</span><input name="cover" type="file" accept="image/jpeg,image/png,image/webp" /><small className="field-help">JPG, PNG или WebP, до 5 МБ.</small></label>
      {currentCoverUrl && <div className="showcase-cover-preview"><Image src={currentCoverUrl} alt="Текущая обложка" width={480} height={270} unoptimized /><label className="toggle-row"><input name="removeCover" type="checkbox" /><span>Удалить текущую обложку</span></label></div>}
      {message && <p className="notice" aria-live="polite">{message}</p>}
      <div className="actions"><button className="button secondary" name="intent" value="draft" disabled={pending || uploading}>{pending ? "Сохраняем…" : "Сохранить черновик"}</button><button className="button" name="intent" value="submit" disabled={pending || uploading}>{uploading ? "Загружаем…" : "Отправить на модерацию"}</button></div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { createCourseAction, updateCourseAction, updateCourseCoverAction } from "@/app/admin/courses/actions";
import type { Course, Instructor, Topic } from "@/lib/courses";

type Props = { course?: Course; topicIds?: string[]; instructorIds?: string[]; topics: Topic[]; instructors: Instructor[]; currentUserId: string };

export function CourseEditor({ course, topicIds = [], instructorIds = [], topics, instructors, currentUserId }: Props) {
  const router = useRouter();
  const coverRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setMessage(null);
    const result = course ? await updateCourseAction(course.id, formData) : await createCourseAction(formData);
    if (!result.ok || !result.id) { setMessage(result.message); return; }

    const file = coverRef.current?.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
        setMessage("Курс сохранён, но обложка должна быть JPEG, PNG или WebP до 8 МБ."); return;
      }
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${result.id}/cover-${Date.now()}.${extension}`;
      const supabase = createClient();
      const upload = await supabase.storage.from("course-covers").upload(path, file, { upsert: false, contentType: file.type });
      if (upload.error) { setMessage("Курс сохранён, но загрузить обложку не удалось."); return; }
      const cover = await updateCourseCoverAction(result.id, path);
      if (!cover.ok) { await supabase.storage.from("course-covers").remove([path]); setMessage(cover.message); return; }
    }
    if (!course) router.push(`/admin/courses/${result.id}/edit`);
    else { setMessage(result.message); router.refresh(); }
  }

  return (
    <form className="card stack" action={(formData) => startTransition(() => void submit(formData))}>
      {message && <p className={message.includes("сохран") ? "notice success" : "notice"}>{message}</p>}
      <div className="form-grid">
        <label className="field"><span>Название *</span><input name="title" required minLength={3} maxLength={140} defaultValue={course?.title ?? ""} /></label>
        <label className="field"><span>Slug</span><input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="создастся из названия" defaultValue={course?.slug ?? ""} /></label>
      </div>
      <label className="field"><span>Короткое описание</span><textarea name="shortDescription" rows={2} maxLength={240} defaultValue={course?.short_description ?? ""} /></label>
      <label className="field"><span>Полное описание *</span><textarea name="description" rows={7} defaultValue={course?.description ?? ""} /></label>
      <div className="form-grid three">
        <label className="field"><span>Доступ</span><select name="accessType" defaultValue={course?.access_type ?? "free"}><option value="free">Бесплатный</option><option value="paid">Платный</option><option value="private">Закрытый</option></select></label>
        <label className="field"><span>Цена</span><input name="priceAmount" type="number" min="0" step="0.01" defaultValue={course?.price_amount ?? 0} /></label>
        <label className="field"><span>Валюта</span><input name="currency" pattern="[A-Z]{3}" maxLength={3} defaultValue={course?.currency ?? "KZT"} /></label>
        <label className="field"><span>Уровень</span><select name="level" defaultValue={course?.level ?? "beginner"}><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></label>
        <label className="field"><span>Длительность, минут</span><input name="estimatedMinutes" type="number" min="0" defaultValue={course?.estimated_minutes ?? ""} /></label>
        <label className="field"><span>Обложка</span><input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" /><small className="field-help">JPEG, PNG или WebP, до 8 МБ.</small></label>
      </div>
      <fieldset className="field"><legend>Темы</legend><div className="topic-grid">{topics.map((topic) => <label className="topic-option" key={topic.id}><input type="checkbox" name="topics" value={topic.id} defaultChecked={topicIds.includes(topic.id)} />{topic.name}</label>)}</div></fieldset>
      <fieldset className="field"><legend>Преподаватели *</legend><div className="topic-grid">{instructors.map((person) => <label className="topic-option" key={person.id}><input type="checkbox" name="instructors" value={person.id} defaultChecked={instructorIds.includes(person.id) || (!course && person.id === currentUserId)} />{person.display_name || `@${person.username}`} · {person.role}</label>)}</div></fieldset>
      <button className="button" disabled={pending}>{pending ? "Сохраняем…" : course ? "Сохранить курс" : "Создать черновик"}</button>
    </form>
  );
}

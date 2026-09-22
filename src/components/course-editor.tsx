"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { BookOpen, Check, ImagePlus, Save, Tags, UsersRound } from "lucide-react";
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
    <form className="studio-course-editor" action={(formData) => startTransition(() => void submit(formData))}>
      <nav className="editor-section-nav" aria-label="Разделы курса"><a href="#course-main">Основное</a>{course && <a href="#course-program">Программа</a>}<a href="#course-categories">Категории</a><a href="#course-instructors">Преподаватели</a><a href="#course-publishing">Публикация</a></nav>
      <div className="editor-sections">
        {message && <p className={message.includes("сохран") ? "notice success" : "notice"} aria-live="polite">{message}</p>}
        <section className="editor-section" id="course-main"><header><BookOpen aria-hidden="true" size={21} /><div><h2>Основное</h2><p>Название, описание и материалы курса.</p></div></header><div className="editor-section-body"><div className="form-grid"><label className="field"><span>Название *</span><input name="title" required minLength={3} maxLength={140} defaultValue={course?.title ?? ""} /></label><label className="field"><span>Slug</span><input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="создастся из названия" defaultValue={course?.slug ?? ""} /></label></div><label className="field"><span>Короткое описание</span><textarea name="shortDescription" rows={2} maxLength={240} defaultValue={course?.short_description ?? ""} /></label><label className="field"><span>Полное описание *</span><textarea name="description" rows={8} defaultValue={course?.description ?? ""} /></label><div className="form-grid"><label className="field"><span>Уровень</span><select name="level" defaultValue={course?.level ?? "beginner"}><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></label><label className="field"><span>Длительность, минут</span><input name="estimatedMinutes" type="number" min="0" defaultValue={course?.estimated_minutes ?? ""} /></label></div><label className="field studio-cover-field"><span><ImagePlus aria-hidden="true" size={17} />Обложка курса</span><input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" /><small className="field-help">JPEG, PNG или WebP, до 8 МБ. Новая обложка заменит текущую после сохранения.</small></label></div></section>
        <section className="editor-section" id="course-categories"><header><Tags aria-hidden="true" size={21} /><div><h2>Категории</h2><p>Темы помогают студентам найти курс в каталоге.</p></div></header><div className="editor-section-body"><fieldset className="field"><legend className="visually-hidden">Темы курса</legend><div className="editor-option-grid">{topics.map((topic) => <label className="editor-check-option" key={topic.id}><input type="checkbox" name="topics" value={topic.id} defaultChecked={topicIds.includes(topic.id)} /><span><Check aria-hidden="true" size={15} />{topic.name}</span></label>)}</div></fieldset></div></section>
        <section className="editor-section" id="course-instructors"><header><UsersRound aria-hidden="true" size={21} /><div><h2>Преподаватели</h2><p>Хотя бы один преподаватель обязателен.</p></div></header><div className="editor-section-body"><fieldset className="field"><legend className="visually-hidden">Преподаватели курса</legend><div className="editor-option-grid instructors">{instructors.map((person) => <label className="editor-check-option" key={person.id}><input type="checkbox" name="instructors" value={person.id} defaultChecked={instructorIds.includes(person.id) || (!course && person.id === currentUserId)} /><span><Check aria-hidden="true" size={15} /><span><strong>{person.display_name || `@${person.username}`}</strong><small>@{person.username} · {person.role}</small></span></span></label>)}</div></fieldset></div></section>
        <section className="editor-section" id="course-publishing"><header><Save aria-hidden="true" size={21} /><div><h2>Публикация</h2><p>Настройте доступ и стоимость. Публикация выполняется после создания программы.</p></div></header><div className="editor-section-body"><div className="form-grid three"><label className="field"><span>Доступ</span><select name="accessType" defaultValue={course?.access_type ?? "free"}><option value="free">Бесплатный</option><option value="paid">Платный</option><option value="private">Закрытый</option></select></label><label className="field"><span>Цена</span><input name="priceAmount" type="number" min="0" step="0.01" defaultValue={course?.price_amount ?? 0} /></label><label className="field"><span>Валюта</span><input name="currency" pattern="[A-Z]{3}" maxLength={3} defaultValue={course?.currency ?? "KZT"} /></label></div></div></section>
      </div>
      <footer className="editor-save-bar"><span>{course ? "Изменения сохраняются в текущий курс" : "Курс будет создан как черновик"}</span><button className="button" disabled={pending}><Save aria-hidden="true" size={18} />{pending ? "Сохраняем…" : course ? "Сохранить курс" : "Создать черновик"}</button></footer>
    </form>
  );
}

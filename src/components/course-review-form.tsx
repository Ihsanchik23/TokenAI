"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCourseReviewAction, saveCourseReviewAction } from "@/app/reviews/actions";

type ExistingReview = { rating: number; text: string | null } | null;

export function CourseReviewForm({
  courseId,
  slug,
  existing,
}: {
  courseId: string;
  slug: string;
  existing: ExistingReview;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [text, setText] = useState(existing?.text ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveCourseReviewAction(courseId, slug, rating, text);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  function remove() {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteCourseReviewAction(courseId, slug);
      setMessage(result.message);
      if (result.ok) {
        setText("");
        setRating(5);
        router.refresh();
      }
    });
  }

  return (
    <div className="card stack">
      <div><h3>{existing ? "Ваш отзыв" : "Оставить отзыв"}</h3><p className="field-help">Оценка доступна после прохождения 50% курса.</p></div>
      <label className="field"><span>Оценка</span><select value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} из 5</option>)}</select></label>
      <label className="field"><span>Текст (необязательно)</span><textarea rows={4} maxLength={2000} value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="actions"><button className="button" type="button" disabled={pending} onClick={save}>{pending ? "Сохраняем…" : existing ? "Обновить" : "Опубликовать"}</button>{existing && <button className="button secondary" type="button" disabled={pending} onClick={remove}>Удалить</button>}</div>
      {message && <p className="field-help" aria-live="polite">{message}</p>}
    </div>
  );
}

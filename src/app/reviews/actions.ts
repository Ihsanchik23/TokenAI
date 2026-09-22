"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReviewActionResult = { ok: boolean; message: string };

export async function saveCourseReviewAction(
  courseId: string,
  slug: string,
  rating: number,
  text: string,
): Promise<ReviewActionResult> {
  await requireUser();
  if (!uuidPattern.test(courseId) || !Number.isInteger(rating) || rating < 1 || rating > 5 || text.trim().length > 2000) {
    return { ok: false, message: "Проверьте оценку и текст отзыва." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_course_review", {
    target_course_id: courseId,
    target_rating: rating,
    review_text: text,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "Отзыв доступен после прохождения не менее 50% курса." };
    return { ok: false, message: "Не удалось сохранить отзыв. Попробуйте ещё раз." };
  }
  revalidatePath(`/courses/${slug}`);
  return { ok: true, message: "Отзыв сохранён." };
}

export async function deleteCourseReviewAction(courseId: string, slug: string): Promise<ReviewActionResult> {
  await requireUser();
  if (!uuidPattern.test(courseId)) return { ok: false, message: "Некорректный курс." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_course_review", { target_course_id: courseId });
  if (error || !data) return { ok: false, message: "Не удалось удалить отзыв." };
  revalidatePath(`/courses/${slug}`);
  return { ok: true, message: "Отзыв удалён." };
}

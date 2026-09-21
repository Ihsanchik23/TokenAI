"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { courseAccessTypes, courseLevels, getYouTubeId, lessonTypes, slugify } from "@/lib/course-utils";
import { createClient } from "@/lib/supabase/server";

export type CourseActionResult = { ok: boolean; message: string; id?: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeMessage(error: { code?: string } | null, fallback: string) {
  if (error?.code === "23505") return "Такой slug уже используется другим курсом.";
  if (error?.code === "42501") return "У вас нет доступа к этому курсу.";
  return fallback;
}

function coursePayload(formData: FormData) {
  const access = String(formData.get("accessType"));
  const level = String(formData.get("level"));
  const title = String(formData.get("title") ?? "").trim();
  const slug = slugify(String(formData.get("slug") || title));
  const instructorIds = formData.getAll("instructors").map(String).filter((id) => uuid.test(id));
  const topicIds = formData.getAll("topics").map(String).filter((id) => uuid.test(id));
  const price = Number(formData.get("priceAmount") || 0);
  const minutes = Number(formData.get("estimatedMinutes") || 0);

  if (title.length < 3 || title.length > 140) throw new Error("Введите название длиной от 3 до 140 символов.");
  if (!slug) throw new Error("Укажите корректный slug латиницей.");
  if (!courseAccessTypes.includes(access as never)) throw new Error("Выберите тип доступа.");
  if (!courseLevels.includes(level as never)) throw new Error("Выберите уровень курса.");
  if (instructorIds.length === 0) throw new Error("Выберите хотя бы одного преподавателя.");
  if (access === "paid" && (!Number.isFinite(price) || price <= 0)) throw new Error("Для платного курса укажите цену больше нуля.");

  return {
    course_title: title,
    course_slug: slug,
    course_short_description: String(formData.get("shortDescription") ?? "").trim(),
    course_description: String(formData.get("description") ?? "").trim(),
    course_access_type: access,
    course_price_amount: access === "paid" ? price : 0,
    course_currency: String(formData.get("currency") || "KZT").trim().toUpperCase(),
    course_level: level,
    course_estimated_minutes: minutes > 0 ? Math.round(minutes) : null,
    selected_topic_ids: topicIds,
    selected_instructor_ids: instructorIds,
  };
}

export async function createCourseAction(formData: FormData): Promise<CourseActionResult> {
  await requireStaff();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_course_with_relations", coursePayload(formData));
    if (error) return { ok: false, message: safeMessage(error, "Не удалось создать курс.") };
    revalidatePath("/admin/courses");
    return { ok: true, message: "Курс создан.", id: data as string };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Проверьте данные курса." };
  }
}

export async function updateCourseAction(courseId: string, formData: FormData): Promise<CourseActionResult> {
  await requireStaff();
  if (!uuid.test(courseId)) return { ok: false, message: "Некорректный курс." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_course_with_relations", { target_course_id: courseId, ...coursePayload(formData) });
    if (error) return { ok: false, message: safeMessage(error, "Не удалось сохранить курс.") };
    revalidatePath("/admin/courses"); revalidatePath(`/admin/courses/${courseId}/edit`); revalidatePath("/courses");
    return { ok: true, message: "Изменения сохранены.", id: courseId };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Проверьте данные курса." };
  }
}

export async function updateCourseCoverAction(courseId: string, path: string | null) {
  await requireStaff();
  if (!uuid.test(courseId) || (path && (!path.startsWith(`${courseId}/`) || path.includes("..")))) return { ok: false, message: "Недопустимый путь обложки." };
  const supabase = await createClient();
  const { data: previous } = await supabase.from("courses").select("cover_path").eq("id", courseId).maybeSingle();
  const { error } = await supabase.from("courses").update({ cover_path: path }).eq("id", courseId);
  if (error) return { ok: false, message: "Не удалось сохранить обложку." };
  if (previous?.cover_path && previous.cover_path !== path) await supabase.storage.from("course-covers").remove([previous.cover_path]);
  revalidatePath(`/admin/courses/${courseId}/edit`); revalidatePath("/courses");
  return { ok: true, message: "Обложка обновлена." };
}

export async function saveModuleAction(courseId: string, moduleId: string | null, formData: FormData) {
  await requireStaff();
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return { ok: false, message: "Введите название модуля." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_course_module", { target_module_id: moduleId, target_course_id: courseId, module_title: title, module_description: String(formData.get("description") ?? "").trim() });
  if (error) return { ok: false, message: safeMessage(error, "Не удалось сохранить модуль.") };
  revalidatePath(`/admin/courses/${courseId}/edit`);
  return { ok: true, message: "Модуль сохранён." };
}

export async function moveModuleAction(courseId: string, moduleId: string, direction: "up" | "down") {
  await requireStaff(); const supabase = await createClient();
  await supabase.rpc("move_course_module", { target_module_id: moduleId, move_direction: direction });
  revalidatePath(`/admin/courses/${courseId}/edit`);
}

export async function deleteModuleAction(courseId: string, moduleId: string) {
  await requireStaff(); const supabase = await createClient();
  await supabase.rpc("delete_course_module", { target_module_id: moduleId });
  revalidatePath(`/admin/courses/${courseId}/edit`);
}

export async function saveLessonAction(courseId: string, lessonId: string | null, formData: FormData): Promise<CourseActionResult> {
  await requireStaff();
  const kind = String(formData.get("lessonType"));
  const moduleId = String(formData.get("moduleId"));
  const title = String(formData.get("title") ?? "").trim();
  if (!uuid.test(moduleId) || !lessonTypes.includes(kind as never) || title.length < 2) return { ok: false, message: "Проверьте основные данные урока." };
  let payload: Record<string, unknown> = {};
  if (kind === "theory") payload = { content: String(formData.get("content") ?? "") };
  if (kind === "video") {
    const videoId = getYouTubeId(String(formData.get("videoUrl") ?? ""));
    if (!videoId) return { ok: false, message: "Укажите корректную YouTube-ссылку или video ID." };
    payload = { video_id: videoId, duration_seconds: Number(formData.get("durationSeconds") || 0) || null };
  }
  if (kind === "assignment") payload = { instructions: String(formData.get("instructions") ?? ""), allow_text: formData.get("allowText") === "on", allow_link: formData.get("allowLink") === "on", allow_file: formData.get("allowFile") === "on", allow_resubmission: formData.get("allowResubmission") === "on" };
  if (kind === "quiz") {
    try { payload = { max_attempts: Number(formData.get("maxAttempts") || 0) || null, questions: JSON.parse(String(formData.get("quizJson") || "[]")) }; }
    catch { return { ok: false, message: "Не удалось прочитать вопросы теста." }; }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_course_lesson", { target_lesson_id: lessonId, target_module_id: moduleId, lesson_title: title, lesson_description: String(formData.get("description") ?? "").trim(), lesson_kind: kind, lesson_is_required: formData.get("isRequired") === "on", lesson_is_preview: formData.get("isPreview") === "on", lesson_payload: payload });
  if (error) return { ok: false, message: safeMessage(error, "Не удалось сохранить урок. Проверьте его содержимое.") };
  revalidatePath(`/admin/courses/${courseId}/edit`);
  return { ok: true, message: "Урок сохранён.", id: data as string };
}

export async function moveLessonAction(courseId: string, lessonId: string, direction: "up" | "down") {
  await requireStaff(); const supabase = await createClient();
  await supabase.rpc("move_course_lesson", { target_lesson_id: lessonId, move_direction: direction });
  revalidatePath(`/admin/courses/${courseId}/edit`);
}

export async function deleteLessonAction(courseId: string, lessonId: string) {
  await requireStaff(); const supabase = await createClient();
  await supabase.rpc("delete_course_lesson", { target_lesson_id: lessonId });
  revalidatePath(`/admin/courses/${courseId}/edit`);
}

export async function setCourseStatusAction(courseId: string, status: "draft" | "published" | "archived"): Promise<CourseActionResult> {
  await requireStaff(); const supabase = await createClient();
  const { error } = await supabase.rpc("set_course_publication_status", { target_course_id: courseId, next_status: status });
  if (error) return { ok: false, message: safeMessage(error, "Курс нельзя опубликовать: заполните описание и добавьте хотя бы один урок.") };
  revalidatePath("/admin/courses"); revalidatePath(`/admin/courses/${courseId}/edit`); revalidatePath("/courses");
  return { ok: true, message: status === "published" ? "Курс опубликован." : "Статус курса обновлён." };
}

export async function deleteCourseAction(courseId: string) {
  await requireStaff();
  if (!uuid.test(courseId)) return;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("cover_path").eq("id", courseId).maybeSingle();
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) redirect(`/admin/courses/${courseId}/edit?error=delete-failed`);
  if (course?.cover_path) await supabase.storage.from("course-covers").remove([course.cover_path]);
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  redirect("/admin/courses");
}

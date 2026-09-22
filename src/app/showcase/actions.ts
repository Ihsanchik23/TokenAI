"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SaveShowcaseInput = {
  id: string | null;
  topicId: string;
  title: string;
  description: string;
  coverPath: string | null;
  externalUrl: string;
  sourceSubmissionId: string | null;
  submit: boolean;
};

type ShowcaseActionResult = {
  ok: boolean;
  message: string;
  id?: string;
  oldCoverPath?: string | null;
};

function validExternalUrl(value: string) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function saveShowcaseWorkAction(input: SaveShowcaseInput): Promise<ShowcaseActionResult> {
  const user = await requireUser();
  if (
    (input.id !== null && !uuidPattern.test(input.id))
    || !uuidPattern.test(input.topicId)
    || (input.sourceSubmissionId !== null && !uuidPattern.test(input.sourceSubmissionId))
    || input.title.trim().length < 3
    || input.title.trim().length > 120
    || input.description.trim().length > 5000
    || input.externalUrl.trim().length > 2000
    || !validExternalUrl(input.externalUrl.trim())
    || (input.coverPath !== null && (!input.coverPath.startsWith(`${user.id}/`) || input.coverPath.includes("..")))
  ) return { ok: false, message: "Проверьте название, описание, категорию и ссылку." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_showcase_work", {
    target_work_id: input.id,
    target_topic_id: input.topicId,
    work_title: input.title,
    work_description: input.description,
    work_cover_path: input.coverPath,
    work_external_url: input.externalUrl,
    target_source_submission_id: input.sourceSubmissionId,
    submit_for_moderation: input.submit,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Для этой отправки Showcase-работа уже создана." };
    if (error.code === "42501") return { ok: false, message: "Работа или подтверждённое задание недоступны." };
    return { ok: false, message: "Не удалось сохранить работу. Проверьте данные и обложку." };
  }
  const result = data as { id?: string; oldCoverPath?: string | null } | null;
  revalidatePath("/profile");
  revalidatePath("/showcase");
  return {
    ok: true,
    message: input.submit ? "Работа отправлена на модерацию." : "Черновик сохранён.",
    id: result?.id,
    oldCoverPath: result?.oldCoverPath ?? null,
  };
}

export async function submitShowcaseWorkAction(workId: string): Promise<ShowcaseActionResult> {
  await requireUser();
  if (!uuidPattern.test(workId)) return { ok: false, message: "Некорректная работа." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_showcase_work", { target_work_id: workId });
  if (error) return { ok: false, message: "Не удалось отправить работу на модерацию." };
  revalidatePath("/profile");
  revalidatePath("/admin/showcase");
  return { ok: true, message: "Работа отправлена на модерацию." };
}

export async function deleteShowcaseWorkAction(workId: string): Promise<ShowcaseActionResult> {
  await requireUser();
  if (!uuidPattern.test(workId)) return { ok: false, message: "Некорректная работа." };
  const supabase = await createClient();
  const { data: coverPath, error } = await supabase.rpc("delete_showcase_work", { target_work_id: workId });
  if (error) return { ok: false, message: "Опубликованную или чужую работу удалить нельзя." };
  if (typeof coverPath === "string") await supabase.storage.from("showcase-files").remove([coverPath]);
  revalidatePath("/profile");
  return { ok: true, message: "Работа удалена." };
}

export async function submitShowcaseWorkFormAction(workId: string) {
  await submitShowcaseWorkAction(workId);
}

export async function deleteShowcaseWorkFormAction(workId: string) {
  await deleteShowcaseWorkAction(workId);
}

export async function moderateShowcaseWorkAction(
  workId: string,
  decision: "published" | "rejected",
  comment: string,
): Promise<ShowcaseActionResult> {
  await requireStaff();
  if (!uuidPattern.test(workId) || !["published", "rejected"].includes(decision) || comment.trim().length > 4000) {
    return { ok: false, message: "Некорректные данные модерации." };
  }
  if (decision === "rejected" && !comment.trim()) return { ok: false, message: "Укажите причину отклонения." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_showcase_work", {
    target_work_id: workId,
    moderation_decision: decision,
    reviewer_comment: comment,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "У вас нет доступа к модерации этой работы." };
    if (error.code === "P0001") return { ok: false, message: "Работа уже была рассмотрена." };
    return { ok: false, message: "Не удалось сохранить решение модератора." };
  }
  revalidatePath("/admin/showcase");
  revalidatePath("/showcase");
  revalidatePath(`/showcase/${workId}`);
  return { ok: true, message: decision === "published" ? "Работа опубликована." : "Работа отклонена." };
}

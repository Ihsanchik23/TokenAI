"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, requireUser } from "@/lib/auth";
import type { UploadedAssignmentFile } from "@/lib/assignments";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActionResult = { ok: boolean; message: string; attemptNumber?: number };

function assignmentError(code?: string) {
  if (code === "42501") return "Задание недоступно или срок доступа к курсу истёк.";
  if (code === "22023") return "Проверьте текст, ссылку и прикреплённые файлы.";
  if (code === "P0001") return "Повторная отправка сейчас недоступна.";
  return "Не удалось отправить работу. Попробуйте ещё раз.";
}

export async function submitAssignmentAction(input: {
  assignmentId: string;
  requestToken: string;
  text: string;
  link: string;
  files: UploadedAssignmentFile[];
}): Promise<ActionResult> {
  const user = await requireUser();
  const inputFiles = Array.isArray(input.files) ? input.files : [];
  const safePaths = Array.isArray(input.files)
    ? inputFiles.filter((file) => file.path.startsWith(`${user.id}/`) && !file.path.includes("..")).map((file) => file.path)
    : [];
  if (!uuidPattern.test(input.assignmentId) || !uuidPattern.test(input.requestToken) || safePaths.length !== inputFiles.length) {
    return { ok: false, message: "Некорректные данные отправки." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_assignment", {
    target_assignment_id: input.assignmentId,
    request_token: input.requestToken,
    answer_text: input.text,
    answer_link: input.link,
    uploaded_files: inputFiles,
  });

  if (error) {
    if (safePaths.length) await supabase.storage.from("submission-files").remove(safePaths);
    return { ok: false, message: assignmentError(error.code) };
  }

  const result = data as { attemptNumber?: number } | null;
  revalidatePath("/my-courses");
  return { ok: true, message: "Работа отправлена преподавателю.", attemptNumber: Number(result?.attemptNumber ?? 0) };
}

export async function reviewAssignmentAction(
  submissionId: string,
  status: "approved" | "needs_revision",
  comment: string,
): Promise<ActionResult> {
  await requireStaff();
  if (!uuidPattern.test(submissionId) || !["approved", "needs_revision"].includes(status)) {
    return { ok: false, message: "Некорректные данные проверки." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_assignment_submission", {
    target_submission_id: submissionId,
    next_status: status,
    review_comment: comment,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, message: "У вас нет доступа к этой работе." };
    if (error.code === "22023") return { ok: false, message: "Для доработки укажите комментарий преподавателя." };
    if (error.code === "P0001") return { ok: false, message: "Эта попытка уже проверена или больше не является последней." };
    return { ok: false, message: "Не удалось сохранить результат проверки." };
  }
  revalidatePath("/admin/submissions");
  return { ok: true, message: status === "approved" ? "Работа принята." : "Работа отправлена на доработку." };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type EnrollmentActionResult = { ok: boolean; message: string };
export type GrantActionState = EnrollmentActionResult;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function enrollFreeAction(courseId: string): Promise<EnrollmentActionResult> {
  await requireUser();
  if (!uuidPattern.test(courseId)) return { ok: false, message: "Некорректный курс." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_in_free_course", { target_course_id: courseId });
  if (error) return { ok: false, message: "Этот курс сейчас недоступен для бесплатного зачисления." };
  revalidatePath("/my-courses"); revalidatePath("/courses");
  return { ok: true, message: "Курс добавлен в «Мои курсы»." };
}

export async function startMockCheckoutAction(courseId: string): Promise<EnrollmentActionResult> {
  await requireUser();
  if (!uuidPattern.test(courseId)) return { ok: false, message: "Некорректный курс." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_mock_order", { target_course_id: courseId });
  const order = Array.isArray(data) ? data[0] : data;
  if (error || !order?.id) {
    return { ok: false, message: error?.code === "23505" ? "У вас уже есть доступ к этому курсу." : "Не удалось создать заказ. Попробуйте ещё раз." };
  }
  redirect(`/checkout/mock/${order.id}`);
}

export async function confirmMockPaymentAction(orderId: string) {
  await requireUser();
  if (!uuidPattern.test(orderId)) redirect("/my-courses?payment=invalid");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_mock_payment", { target_order_id: orderId });
  if (error) redirect(`/checkout/mock/${orderId}?error=payment-failed`);
  revalidatePath("/my-courses"); revalidatePath("/courses");
  redirect("/my-courses?payment=success");
}

export async function startCourseAction(courseId: string) {
  await requireUser();
  if (!uuidPattern.test(courseId)) redirect("/my-courses");
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_my_course", { target_course_id: courseId });
  if (error) redirect("/my-courses?course=unavailable");
  const { data: course } = await supabase.from("courses").select("slug").eq("id", courseId).maybeSingle();
  revalidatePath("/my-courses");
  redirect(course?.slug ? `/learn/${course.slug}` : "/my-courses");
}

export async function grantCourseAccessAction(
  _previousState: GrantActionState,
  formData: FormData,
): Promise<GrantActionState> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  const expiryValue = String(formData.get("expiresAt") ?? "").trim();
  if (!uuidPattern.test(userId) || !uuidPattern.test(courseId)) return { ok: false, message: "Выберите пользователя и курс." };

  let expiresAt: string | null = null;
  if (expiryValue) {
    const date = new Date(`${expiryValue}T23:59:59.999Z`);
    if (Number.isNaN(date.getTime()) || date <= new Date()) return { ok: false, message: "Дата окончания должна быть в будущем." };
    expiresAt = date.toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_grant_course_access", {
    target_user_id: userId,
    target_course_id: courseId,
    access_expires_at: expiresAt,
  });
  if (error) return { ok: false, message: "Не удалось выдать доступ. Проверьте пользователя и курс." };
  revalidatePath("/admin/access"); revalidatePath("/my-courses");
  return { ok: true, message: "Доступ к курсу выдан." };
}

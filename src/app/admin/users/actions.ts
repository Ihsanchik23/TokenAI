"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setUserRoleAction(targetUserId: string, nextRole: "student" | "instructor") {
  await requireAdmin();
  if (!uuid.test(targetUserId) || !["student", "instructor"].includes(nextRole)) return { ok: false, message: "Некорректные данные пользователя." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", { target_user_id: targetUserId, new_role: nextRole });
  if (error) return { ok: false, message: error.code === "42501" ? "Недостаточно прав для изменения этой роли." : "Не удалось изменить роль пользователя." };
  revalidatePath("/admin/users");
  revalidatePath("/admin/courses");
  revalidatePath("/", "layout");
  return { ok: true, message: "Роль пользователя изменена" };
}

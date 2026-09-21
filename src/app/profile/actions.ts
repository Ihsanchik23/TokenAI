"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ensureMyProfile, getMyProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"displayName" | "username" | "bio", string>>;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await requireUser();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const bio = String(formData.get("bio") ?? "").trim();
  const isPublic = formData.get("isPublic") === "on";
  const topicIds = formData
    .getAll("topics")
    .map(String)
    .filter((value) => uuidPattern.test(value));
  const fieldErrors: ProfileActionState["fieldErrors"] = {};

  if (displayName.length < 2 || displayName.length > 80) {
    fieldErrors.displayName = "Укажите имя длиной от 2 до 80 символов.";
  }

  if (!/^[a-z0-9_]{3,48}$/.test(username)) {
    fieldErrors.username =
      "Используйте 3–48 строчных латинских букв, цифр или символов _.";
  }

  if (bio.length > 500) {
    fieldErrors.bio = "Описание не должно превышать 500 символов.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();

  try {
    await ensureMyProfile(supabase);
  } catch {
    return {
      status: "error",
      message: "Не удалось подготовить профиль. Попробуйте ещё раз.",
    };
  }

  const previousProfile = await getMyProfile(supabase, user.id);
  const { error } = await supabase.rpc("update_my_profile", {
    new_username: username,
    new_display_name: displayName,
    new_bio: bio,
    new_is_public: isPublic,
    selected_topic_ids: topicIds,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { username: "Этот username уже занят." },
      };
    }

    return {
      status: "error",
      message: "Не удалось сохранить профиль. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/onboarding");
  revalidatePath(`/students/${username}`);

  if (previousProfile?.username && previousProfile.username !== username) {
    revalidatePath(`/students/${previousProfile.username}`);
  }

  if (formData.get("intent") === "onboarding") {
    redirect("/profile");
  }

  return { status: "success", message: "Профиль сохранён." };
}

export async function updateAvatarPath(path: string) {
  const user = await requireUser();

  if (!path.startsWith(`${user.id}/`) || path.includes("..")) {
    return { error: "Недопустимый путь файла." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", user.id);

  if (error) {
    return { error: "Не удалось обновить аватар профиля." };
  }

  revalidatePath("/profile");
  revalidatePath("/onboarding");

  return { error: null };
}

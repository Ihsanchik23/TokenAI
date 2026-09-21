"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ensureMyProfile,
  getMyProfile,
  isProfileComplete,
} from "@/lib/profile";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<
    Record<"email" | "password" | "confirmPassword", string>
  >;
};

function authErrorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials":
      return "Неверный email или пароль.";
    case "email_not_confirmed":
      return "Сначала подтвердите email по ссылке из письма.";
    case "user_already_exists":
    case "email_exists":
      return "Аккаунт с таким email уже существует.";
    case "weak_password":
      return "Пароль не соответствует требованиям безопасности.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Слишком много попыток. Подождите несколько минут.";
    default:
      return "Не удалось выполнить запрос. Попробуйте ещё раз.";
  }
}

function readCredentials(formData: FormData, includeConfirmation: boolean) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Введите корректный email.";
  }

  if (password.length < 8) {
    fieldErrors.password = "Пароль должен содержать минимум 8 символов.";
  }

  if (includeConfirmation && password !== confirmPassword) {
    fieldErrors.confirmPassword = "Пароли не совпадают.";
  }

  return { email, password, fieldErrors };
}

function safeDestination(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

async function destinationAfterAuth(requestedDestination = "/profile") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (typeof userId !== "string") {
    return "/login";
  }

  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, userId);

  return isProfileComplete(profile) ? safeDestination(requestedDestination) : "/onboarding";
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { email, password, fieldErrors } = readCredentials(formData, true);

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  const requestHeaders = await headers();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    requestHeaders.get("origin") ??
    "http://localhost:3000";
  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set("next", "/onboarding");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl.toString() },
  });

  if (error) {
    return { status: "error", message: authErrorMessage(error.code) };
  }

  if (data.session) {
    const destination = await destinationAfterAuth();
    redirect(destination);
  }

  return {
    status: "success",
    message:
      "Проверьте почту и подтвердите регистрацию. После подтверждения вы вернётесь в TokenAI.",
  };
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { email, password, fieldErrors } = readCredentials(formData, false);

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", message: authErrorMessage(error.code) };
  }

  let destination = "/onboarding";

  try {
    destination = await destinationAfterAuth(
      safeDestination(String(formData.get("next") ?? "/profile")),
    );
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return {
      status: "error",
      message: "Не удалось подготовить профиль. Попробуйте войти ещё раз.",
    };
  }

  redirect(destination);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?message=signed-out");
}

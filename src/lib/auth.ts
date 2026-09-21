import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getOptionalUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;

  if (error || typeof subject !== "string") {
    return null;
  }

  return {
    id: subject,
    email: typeof claims?.email === "string" ? claims.email : undefined,
  };
}

export async function requireUser() {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/login?message=auth-required");
  }

  return user;
}

export async function requireStaff() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "instructor") {
    redirect("/profile?message=staff-required");
  }

  return { ...user, role: profile.role };
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/profile?message=admin-required");
  }

  return { ...user, role: profile.role };
}

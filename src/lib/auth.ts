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

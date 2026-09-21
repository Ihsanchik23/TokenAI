import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ensureMyProfile,
  getMyProfile,
  isProfileComplete,
} from "@/lib/profile";

function safeDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return noStoreRedirect(
      new URL("/auth/error?reason=invalid-or-expired", url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return noStoreRedirect(
      new URL("/auth/error?reason=invalid-or-expired", url.origin),
    );
  }

  try {
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (typeof userId !== "string") {
      throw new Error("Missing user");
    }

    await ensureMyProfile(supabase);
    const profile = await getMyProfile(supabase, userId);
    const requestedDestination = safeDestination(url.searchParams.get("next"));
    const destination = isProfileComplete(profile)
      ? requestedDestination
      : "/onboarding";

    return noStoreRedirect(new URL(destination, url.origin));
  } catch {
    return noStoreRedirect(
      new URL("/auth/error?reason=profile", url.origin),
    );
  }
}

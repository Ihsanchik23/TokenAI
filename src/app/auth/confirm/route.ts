import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureMyProfile } from "@/lib/profile";

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return noStoreRedirect(
      new URL("/auth/error?reason=invalid-or-expired", url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    return noStoreRedirect(
      new URL("/auth/error?reason=invalid-or-expired", url.origin),
    );
  }

  try {
    await ensureMyProfile(supabase);
    return noStoreRedirect(new URL("/onboarding", url.origin));
  } catch {
    return noStoreRedirect(
      new URL("/auth/error?reason=profile", url.origin),
    );
  }
}

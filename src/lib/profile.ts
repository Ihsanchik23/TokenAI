import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  is_public: boolean;
  role: "student" | "instructor" | "admin";
  created_at: string;
};

export type Topic = {
  id: string;
  name: string;
  slug: string;
};

export function isProfileComplete(profile: Profile | null) {
  return Boolean(
    profile?.display_name?.trim() &&
      profile.username &&
      !profile.username.startsWith("user_"),
  );
}

export async function ensureMyProfile(supabase: SupabaseClient) {
  const { error } = await supabase.rpc("ensure_my_profile");

  if (error) {
    throw new Error("PROFILE_ENSURE_FAILED");
  }
}

export async function getMyProfile(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, bio, avatar_path, is_public, role, created_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("PROFILE_LOAD_FAILED");
  }

  return data as Profile | null;
}

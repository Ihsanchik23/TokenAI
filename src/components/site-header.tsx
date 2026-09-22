import { AppNavigation } from "@/components/app-navigation";
import { getOptionalUser } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const user = await getOptionalUser();
  const supabase = user ? await createClient() : null;
  const { data: profile } = supabase
    ? await supabase.from("profiles").select("role,display_name,avatar_path").eq("id", user!.id).maybeSingle()
    : { data: null };
  const { data: unreadCount } = supabase ? await supabase.rpc("get_unread_notification_count") : { data: 0 };
  const canAccessStudio = profile?.role === "admin" || profile?.role === "instructor";

  return (
    <AppNavigation
      user={user ? {
        email: user.email,
        displayName: profile?.display_name ?? null,
        avatarUrl: getAvatarUrl(profile?.avatar_path ?? null),
      } : null}
      canAccessStudio={canAccessStudio}
      unreadCount={Number(unreadCount ?? 0)}
    />
  );
}

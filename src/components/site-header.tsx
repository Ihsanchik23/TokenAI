import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { getOptionalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const user = await getOptionalUser();
  const supabase = user ? await createClient() : null;
  const { data: profile } = supabase
    ? await supabase.from("profiles").select("role").eq("id", user!.id).maybeSingle()
    : { data: null };
  const { data: unreadCount } = supabase ? await supabase.rpc("get_unread_notification_count") : { data: 0 };

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Основная навигация">
        <Link className="brand" href="/">
          TokenAI
        </Link>
        <div className="nav-links">
          <Link href="/courses">Курсы</Link>
          <Link href="/students">Студенты</Link>
          <Link href="/showcase">Showcase</Link>
          {user ? (
            <>
              {(profile?.role === "admin" || profile?.role === "instructor") && <Link href="/admin">Studio</Link>}
              <Link href="/my-courses">Мои курсы</Link>
              <Link href="/notifications">Уведомления{Number(unreadCount) > 0 ? ` (${unreadCount})` : ""}</Link>
              <Link href="/profile">Профиль</Link>
              <form action={logoutAction}>
                <button className="link-button" type="submit">
                  Выйти
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">Войти</Link>
              <Link className="button small" href="/signup">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

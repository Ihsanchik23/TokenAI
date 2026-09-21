import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { getOptionalUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getOptionalUser();

  return (
    <header className="site-header">
      <nav className="nav-shell" aria-label="Основная навигация">
        <Link className="brand" href="/">
          TokenAI
        </Link>
        <div className="nav-links">
          {user ? (
            <>
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

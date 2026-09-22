"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  GraduationCap,
  Home,
  LogIn,
  Menu,
  Moon,
  Plus,
  Sun,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";

type AppNavigationProps = {
  user: {
    email?: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  canAccessStudio: boolean;
  unreadCount: number;
};

const primaryLinks = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/courses", label: "Каталог", icon: BookOpen },
  { href: "/my-courses", label: "Мои курсы", icon: GraduationCap },
  { href: "/students", label: "Студенты", icon: UsersRound },
] as const;

const mobileLinks = [
  ...primaryLinks,
  { href: "/profile", label: "Профиль", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/courses") return pathname.startsWith("/courses");
  if (href === "/my-courses") {
    return pathname.startsWith("/my-courses") || pathname.startsWith("/learn");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem("tokenai-theme", next);
  }

  return (
    <button
      className={compact ? "utility-button theme-toggle" : "drawer-action theme-toggle"}
      type="button"
      onClick={toggleTheme}
      aria-label="Переключить цветовую тему"
      title={compact ? "Переключить цветовую тему" : undefined}
    >
      <Sun className="theme-icon-light" aria-hidden="true" size={18} strokeWidth={1.8} />
      <Moon className="theme-icon-dark" aria-hidden="true" size={18} strokeWidth={1.8} />
      {!compact && <><span className="theme-label-light">Светлая тема</span><span className="theme-label-dark">Тёмная тема</span></>}
    </button>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  return (
    <span className="nav-avatar" aria-hidden="true">
      {src ? <Image src={src} alt="" width={34} height={34} unoptimized /> : name.charAt(0).toUpperCase()}
    </span>
  );
}

export function AppNavigation({ user, canAccessStudio, unreadCount }: AppNavigationProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const userName = user?.displayName || user?.email || "Профиль";

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [drawerOpen]);

  return (
    <>
      <header className="site-header">
        <nav className="nav-shell" aria-label="Основная навигация">
          <Link className="brand" href="/" aria-label="TokenAI — главная">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span>TokenAI</span>
          </Link>

          <div className="desktop-primary-nav">
            {primaryLinks.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                className={isActive(pathname, item.href) ? "active" : undefined}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="desktop-utilities">
            {canAccessStudio && (
              <Link className="studio-button" href="/admin">
                <Plus aria-hidden="true" size={17} strokeWidth={2.3} />
                <span>Studio</span>
              </Link>
            )}
            {user && (
              <Link className="utility-button notification-button" href="/notifications" aria-label={`Уведомления${unreadCount ? `: ${unreadCount} непрочитанных` : ""}`}>
                <Bell aria-hidden="true" size={19} strokeWidth={1.8} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </Link>
            )}
            <ThemeToggle compact />
            {user ? (
              <details className="profile-menu">
                <summary aria-label="Открыть меню профиля">
                  <Avatar name={userName} src={user.avatarUrl} />
                  <ChevronDown aria-hidden="true" size={15} />
                </summary>
                <div className="profile-popover">
                  <div className="profile-popover-heading">
                    <strong>{userName}</strong>
                    {user.email && user.displayName && <span>{user.email}</span>}
                  </div>
                  <Link href="/profile"><UserRound aria-hidden="true" size={17} />Профиль</Link>
                  <Link href="/notifications"><Bell aria-hidden="true" size={17} />Уведомления</Link>
                  <form action={logoutAction}>
                    <button type="submit"><LogIn aria-hidden="true" size={17} />Выйти</button>
                  </form>
                </div>
              </details>
            ) : (
              <div className="guest-actions">
                <Link href="/login">Войти</Link>
                <Link className="button small" href="/signup">Регистрация</Link>
              </div>
            )}
          </div>

          <div className="mobile-utilities">
            {canAccessStudio && (
              <Link className="studio-icon-button" href="/admin" aria-label="Открыть Studio">
                <Plus aria-hidden="true" size={19} strokeWidth={2.5} />
              </Link>
            )}
            {user && (
              <Link className="utility-button notification-button" href="/notifications" aria-label={`Уведомления${unreadCount ? `: ${unreadCount} непрочитанных` : ""}`}>
                <Bell aria-hidden="true" size={20} strokeWidth={1.8} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </Link>
            )}
            <button ref={menuButtonRef} className="utility-button" type="button" aria-label="Открыть дополнительное меню" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
              <Menu aria-hidden="true" size={21} strokeWidth={1.8} />
            </button>
          </div>
        </nav>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Мобильная навигация">
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link href={item.href} key={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" size={21} strokeWidth={active ? 2.2 : 1.7} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {drawerOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false);
        }}>
          <div className="mobile-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Дополнительное меню" tabIndex={-1}>
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Меню</p>
                <strong>{user ? userName : "TokenAI"}</strong>
              </div>
              <button className="utility-button" type="button" onClick={() => setDrawerOpen(false)} aria-label="Закрыть меню">
                <X aria-hidden="true" size={21} />
              </button>
            </div>
            <div className="drawer-links">
              {user ? (
                <>
                  <Link href="/notifications" onClick={() => setDrawerOpen(false)}><Bell aria-hidden="true" size={19} />Уведомления{unreadCount > 0 && <span className="drawer-count">{unreadCount}</span>}</Link>
                  <ThemeToggle />
                  <form action={logoutAction}>
                    <button className="drawer-action" type="submit"><LogIn aria-hidden="true" size={19} />Выйти</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setDrawerOpen(false)}><LogIn aria-hidden="true" size={19} />Войти</Link>
                  <Link href="/signup" onClick={() => setDrawerOpen(false)}><UserRound aria-hidden="true" size={19} />Регистрация</Link>
                  <ThemeToggle />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

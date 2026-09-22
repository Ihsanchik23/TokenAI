"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Gauge,
  ImageIcon,
  KeyRound,
} from "lucide-react";

const links = [
  { href: "/admin", label: "Обзор", icon: Gauge, exact: true },
  { href: "/admin/courses", label: "Курсы", icon: BookOpen },
  { href: "/admin/submissions", label: "Задания", icon: ClipboardCheck },
  { href: "/admin/showcase", label: "Showcase", icon: ImageIcon },
  { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
] as const;

export function StudioNavigation({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const visibleLinks = isAdmin
    ? [...links, { href: "/admin/access", label: "Доступ", icon: KeyRound, exact: false as const }]
    : links;

  const active = (href: string, exact?: boolean) => exact ? pathname === href : pathname.startsWith(href);
  const current = visibleLinks.find((item) => active(item.href, "exact" in item ? item.exact : false));

  const navigation = (
    <>
      {visibleLinks.map((item) => {
        const Icon = item.icon;
        const selected = active(item.href, "exact" in item ? item.exact : false);
        return <Link className={selected ? "active" : undefined} href={item.href} aria-current={selected ? "page" : undefined} key={item.href}><Icon aria-hidden="true" size={18} /><span>{item.label}</span></Link>;
      })}
    </>
  );

  return (
    <>
      <aside className="studio-sidebar">
        <div className="studio-brand"><span>Studio</span><small>TokenAI workspace</small></div>
        <nav aria-label="Навигация Studio">{navigation}</nav>
        <Link className="studio-public-link" href="/courses"><ExternalLink aria-hidden="true" size={17} />Вернуться на сайт</Link>
      </aside>
      <details className="studio-mobile-nav">
        <summary><span><strong>Studio</strong><small>{current?.label ?? "Рабочая область"}</small></span><ChevronDown aria-hidden="true" size={18} /></summary>
        <nav aria-label="Мобильная навигация Studio">{navigation}<Link href="/courses"><ExternalLink aria-hidden="true" size={17} /><span>Вернуться на сайт</span></Link></nav>
      </details>
    </>
  );
}

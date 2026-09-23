import Image from "next/image";
import Link from "next/link";
import { Search, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { StudioRoleAction } from "@/components/studio-role-action";
import { requireAdmin } from "@/lib/auth";
import { getAvatarUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

type StudioUser = { id: string; displayName: string | null; username: string; email: string | null; avatarPath: string | null; role: "student" | "instructor" | "admin" };
type UsersPayload = { users: StudioUser[]; total: number; page: number; pageSize: number };
const roleLabels = { student: "Студент", instructor: "Преподаватель", admin: "Администратор" } as const;

export default async function StudioUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const role = ["student", "instructor", "admin"].includes(params.role ?? "") ? params.role as StudioUser["role"] : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_studio_users", { search_text: (params.q ?? "").slice(0, 100), role_filter: role, page_number: page, page_size: 25 });
  const payload = (data ?? { users: [], total: 0, page, pageSize: 25 }) as UsersPayload;
  const pages = Math.max(1, Math.ceil(payload.total / payload.pageSize));
  const pageHref = (target: number) => { const query = new URLSearchParams(); if (params.q) query.set("q", params.q); if (role) query.set("role", role); query.set("page", String(target)); return `/admin/users?${query}`; };

  return <section className="studio-page studio-users-page">
    <header className="studio-page-heading"><div><p className="eyebrow">Только администратор</p><h1>Пользователи</h1><p>Назначайте преподавателей без выдачи административных прав.</p></div><span className="admin-only-mark"><ShieldCheck aria-hidden="true" size={18} />Admin</span></header>
    <form className="studio-filter-bar users-filter" role="search"><label><Search aria-hidden="true" size={18} /><span className="visually-hidden">Поиск пользователя</span><input name="q" defaultValue={params.q ?? ""} placeholder="Имя, username или email" /></label><label><span className="visually-hidden">Роль</span><select name="role" defaultValue={role ?? ""}><option value="">Все роли</option><option value="student">Студенты</option><option value="instructor">Преподаватели</option><option value="admin">Администраторы</option></select></label><button className="button secondary">Найти</button></form>
    {error ? <div className="studio-empty"><UsersRound aria-hidden="true" size={28} /><h2>Не удалось загрузить пользователей</h2><p>Обновите страницу и повторите попытку.</p></div> : payload.users.length ? <div className="studio-table-wrap"><table className="studio-table studio-users-table"><thead><tr><th>Пользователь</th><th>Email</th><th>Роль</th><th><span className="visually-hidden">Действие</span></th></tr></thead><tbody>{payload.users.map((user) => { const name = user.displayName || `@${user.username}`; const avatar = getAvatarUrl(user.avatarPath); return <tr key={user.id}><td data-label="Пользователь"><span className="studio-user-identity"><span className="studio-user-avatar">{avatar ? <Image src={avatar} alt="" width={38} height={38} unoptimized /> : <UserRound aria-hidden="true" size={18} />}</span><span><strong>{name}</strong><small>@{user.username}</small></span></span></td><td data-label="Email"><span className="studio-user-email">{user.email ?? "—"}</span></td><td data-label="Роль"><span className={`studio-status role-${user.role}`}>{roleLabels[user.role]}</span></td><td className="studio-role-cell">{user.role === "admin" || user.id === admin.id ? <span className="role-locked">Без изменений</span> : <StudioRoleAction userId={user.id} name={name} role={user.role} />}</td></tr>; })}</tbody></table></div> : <div className="studio-empty"><UsersRound aria-hidden="true" size={28} /><h2>Пользователи не найдены</h2><p>Измените запрос или выбранную роль.</p></div>}
    {pages > 1 && <nav className="studio-pagination" aria-label="Страницы пользователей"><Link className={payload.page <= 1 ? "disabled" : ""} aria-disabled={payload.page <= 1} href={pageHref(Math.max(1, payload.page - 1))}>Назад</Link><span>{payload.page} из {pages} · {payload.total}</span><Link className={payload.page >= pages ? "disabled" : ""} aria-disabled={payload.page >= pages} href={pageHref(Math.min(pages, payload.page + 1))}>Далее</Link></nav>}
  </section>;
}

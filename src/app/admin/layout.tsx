import Link from "next/link";
import { requireStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return <main className="page-shell admin-shell"><header className="admin-header"><div><p className="eyebrow">Панель {staff.role === "admin" ? "администратора" : "преподавателя"}</p><h1>TokenAI Studio</h1></div><nav className="actions"><Link href="/admin">Обзор</Link><Link href="/admin/courses">Курсы</Link><Link href="/admin/submissions">Задания</Link><Link href="/admin/showcase">Showcase</Link>{staff.role === "admin" && <Link href="/admin/access">Выдать доступ</Link>}<Link href="/courses">Каталог</Link></nav></header>{children}</main>;
}

import { requireStaff } from "@/lib/auth";
import { StudioNavigation } from "@/components/studio-navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return <main className="studio-shell"><StudioNavigation isAdmin={staff.role === "admin"} /><div className="studio-workspace"><header className="studio-topbar"><p>{staff.role === "admin" ? "Администратор" : "Преподаватель"}</p><span>TokenAI Studio</span></header>{children}</div></main>;
}

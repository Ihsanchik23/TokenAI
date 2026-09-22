import { AdminGrantForm } from "@/components/admin-grant-form";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAccessPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: users }, { data: courses }, { data: grants }] = await Promise.all([
    supabase.from("profiles").select("id,username,display_name").order("username"),
    supabase.from("courses").select("id,title,status").order("title"),
    supabase.from("enrollments").select("id,user_id,course_id,status,access_source,expires_at").eq("access_source", "admin").order("access_granted_at", { ascending: false }).limit(20),
  ]);

  const userById = new Map((users ?? []).map((user) => [user.id, user]));
  const courseById = new Map((courses ?? []).map((course) => [course.id, course]));

  return <section className="studio-page access-page"><header className="studio-page-heading"><div><p className="eyebrow">Только администратор</p><h1>Ручной доступ</h1><p>Для закрытых курсов и исключительных случаев.</p></div><span className="admin-only-mark"><ShieldCheck aria-hidden="true" size={18} />Admin</span></header><div className="access-layout"><div><AdminGrantForm users={users ?? []} courses={courses ?? []} /></div><section className="recent-grants"><div className="studio-section-heading"><div><p className="eyebrow">История</p><h2>Последние выдачи</h2></div></div>{grants?.length ? <div>{grants.map((grant) => { const user = userById.get(grant.user_id); const course = courseById.get(grant.course_id); return <article key={grant.id}><KeyRound aria-hidden="true" size={17} /><span><strong>{user?.display_name || `@${user?.username ?? "user"}`}</strong><small>{course?.title ?? "Курс"}</small></span><span>{grant.expires_at ? `до ${new Date(grant.expires_at).toLocaleDateString("ru-RU")}` : "Бессрочно"}</span></article>; })}</div> : <p className="studio-empty-inline">Ручных выдач пока нет.</p>}</section></div></section>;
}
import { KeyRound, ShieldCheck } from "lucide-react";

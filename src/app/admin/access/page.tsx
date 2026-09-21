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

  return <section className="stack roomy"><div><p className="eyebrow">Доступ</p><h2>Выдать доступ вручную</h2><p className="muted">Для private-курсов и исключительных случаев. Только администратор.</p></div><AdminGrantForm users={users ?? []} courses={courses ?? []} />{Boolean(grants?.length) && <div className="card stack"><h2>Последние выдачи</h2>{grants?.map((grant) => { const user = userById.get(grant.user_id); const course = courseById.get(grant.course_id); return <div className="course-row" key={grant.id}><span>{user?.display_name || `@${user?.username ?? "user"}`} → {course?.title ?? "Курс"}</span><span className="muted">{grant.expires_at ? `до ${new Date(grant.expires_at).toLocaleDateString("ru-RU")}` : "бессрочно"}</span></div>; })}</div>}</section>;
}

"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { grantCourseAccessAction, type GrantActionState } from "@/app/enrollment/actions";

const initialState: GrantActionState = { ok: false, message: "" };

export function AdminGrantForm({ users, courses }: { users: { id: string; username: string; display_name: string | null }[]; courses: { id: string; title: string; status: string }[] }) {
  const [state, action, pending] = useActionState(grantCourseAccessAction, initialState);
  return (
    <form action={action} className="admin-grant-form">
      <header><KeyRound aria-hidden="true" size={22} /><div><h2>Выдать доступ</h2><p>Запись появится в списке курсов студента.</p></div></header>
      <label className="field"><span>Пользователь</span><select name="userId" required defaultValue=""><option value="" disabled>Выберите пользователя</option>{users.map((user) => <option value={user.id} key={user.id}>{user.display_name || `@${user.username}`} (@{user.username})</option>)}</select></label>
      <label className="field"><span>Курс</span><select name="courseId" required defaultValue=""><option value="" disabled>Выберите курс</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title} · {course.status}</option>)}</select></label>
      <label className="field"><span>Доступ до (необязательно)</span><input name="expiresAt" type="date" /><small className="field-help">Доступ действует до конца выбранного дня по UTC. Пустое поле означает бессрочный доступ.</small></label>
      {state.message && <p className={state.ok ? "notice success" : "notice"}>{state.message}</p>}
      <button className="button" disabled={pending}><KeyRound aria-hidden="true" size={17} />{pending ? "Выдаём доступ…" : "Выдать доступ"}</button>
    </form>
  );
}

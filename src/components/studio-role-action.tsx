"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus } from "lucide-react";
import { setUserRoleAction } from "@/app/admin/users/actions";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

export function StudioRoleAction({ userId, name, role }: { userId: string; name: string; role: "student" | "instructor" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const nextRole = role === "student" ? "instructor" : "student";
  const adding = nextRole === "instructor";

  function confirm() {
    startTransition(async () => {
      const result = await setUserRoleAction(userId, nextRole);
      setFeedback(result);
      setOpen(false);
      if (result.ok) router.refresh();
    });
  }

  return <div className="studio-role-action">
    <button className="role-change-button" type="button" onClick={() => { setFeedback(null); setOpen(true); }}>{adding ? <UserPlus aria-hidden="true" size={16} /> : <UserMinus aria-hidden="true" size={16} />}{adding ? "Сделать преподавателем" : "Убрать роль преподавателя"}</button>
    {feedback && !open && <span className={`role-action-feedback ${feedback.ok ? "success" : "error"}`} role={feedback.ok ? "status" : "alert"}>{feedback.message}</span>}
    <ConfirmationDialog open={open} title={adding ? "Назначить преподавателем?" : "Убрать роль преподавателя?"} description={adding ? `${name} получит доступ к Studio. Управлять можно будет только назначенными курсами.` : `${name} потеряет доступ к Studio после обновления или следующего перехода.`} confirmLabel={adding ? "Назначить" : "Убрать роль"} danger={!adding} pending={pending} onCancel={() => setOpen(false)} onConfirm={confirm} />
  </div>;
}

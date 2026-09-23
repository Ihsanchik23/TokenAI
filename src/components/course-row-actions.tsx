"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, Eye, MoreHorizontal, Pencil, Send, Undo2 } from "lucide-react";
import { setCourseStatusAction } from "@/app/admin/courses/actions";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

type Status = "draft" | "published" | "archived";

export function CourseRowActions({ id, title, status }: { id: string; title: string; status: Status }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function change(next: Status) { startTransition(async () => { const result = await setCourseStatusAction(id, next); setMessage(result.message); if (result.ok) setConfirmArchive(false); }); }
  return <div className="course-row-menu-wrap">
    <details className="course-row-menu"><summary aria-label={`Действия с курсом «${title}»`}><MoreHorizontal aria-hidden="true" size={18} /></summary><div><Link href={`/admin/courses/${id}/edit`}><Pencil aria-hidden="true" size={15} />Редактировать</Link><Link href={`/admin/courses/${id}/preview`}><Eye aria-hidden="true" size={15} />Предпросмотр</Link>{status !== "published" && <button type="button" disabled={pending} onClick={() => change("published")}><Send aria-hidden="true" size={15} />Опубликовать</button>}{status === "published" && <button type="button" disabled={pending} onClick={() => change("draft")}><Undo2 aria-hidden="true" size={15} />Снять с публикации</button>}{status !== "archived" && <button className="danger" type="button" disabled={pending} onClick={() => setConfirmArchive(true)}><Archive aria-hidden="true" size={15} />В архив</button>}</div></details>
    {message && <span className="row-action-feedback" role="status">{message}</span>}
    <ConfirmationDialog open={confirmArchive} title="Архивировать курс?" description={`Курс «${title}» исчезнет из каталога. Его можно будет вернуть в черновики позже.`} confirmLabel="Архивировать" danger pending={pending} onCancel={() => setConfirmArchive(false)} onConfirm={() => change("archived")} />
  </div>;
}

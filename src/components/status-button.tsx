"use client";

import { useState, useTransition } from "react";
import { Archive, Rocket, Undo2 } from "lucide-react";
import { setCourseStatusAction } from "@/app/admin/courses/actions";

export function StatusButton({ courseId, status }: { courseId: string; status: "draft" | "published" | "archived" }) {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  function update(next: "draft" | "published" | "archived") { startTransition(async () => { const result = await setCourseStatusAction(courseId, next); setMessage(result.message); }); }
  return <div className="course-status-actions"><div>{status === "published" ? <><button className="button small secondary" type="button" disabled={pending} onClick={() => update("draft")}><Undo2 aria-hidden="true" size={16} />В черновик</button><button className="button small secondary" type="button" disabled={pending} onClick={() => update("archived")}><Archive aria-hidden="true" size={16} />В архив</button></> : <button className="button small" type="button" disabled={pending} onClick={() => update("published")}><Rocket aria-hidden="true" size={16} />{pending ? "Обновляем…" : "Опубликовать"}</button>}</div>{message && <small aria-live="polite">{message}</small>}</div>;
}

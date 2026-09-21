"use client";

import { useState, useTransition } from "react";
import { saveModuleAction } from "@/app/admin/courses/actions";

export function ModuleForm({ courseId, module }: { courseId: string; module?: { id: string; title: string; description: string | null } }) {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  return <form className="inline-editor stack compact" action={(data) => startTransition(async () => { const result = await saveModuleAction(courseId, module?.id ?? null, data); setMessage(result.message); })}>
    <input name="title" required minLength={2} placeholder="Название модуля" defaultValue={module?.title ?? ""} />
    <textarea name="description" rows={2} placeholder="Описание модуля" defaultValue={module?.description ?? ""} />
    {message && <small className={message.includes("сохран") ? "success-text" : "field-error"}>{message}</small>}
    <button className="button small secondary" disabled={pending}>{pending ? "Сохраняем…" : module ? "Изменить модуль" : "Добавить модуль"}</button>
  </form>;
}

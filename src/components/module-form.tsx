"use client";

import { useState, useTransition } from "react";
import { Plus, Save } from "lucide-react";
import { saveModuleAction } from "@/app/admin/courses/actions";

export function ModuleForm({ courseId, module }: { courseId: string; module?: { id: string; title: string; description: string | null } }) {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  return <form className="module-inline-editor" action={(data) => startTransition(async () => { const result = await saveModuleAction(courseId, module?.id ?? null, data); setMessage(result.message); })}>
    <label className="field"><span>Название</span><input name="title" required minLength={2} placeholder="Название модуля" defaultValue={module?.title ?? ""} /></label>
    <label className="field"><span>Описание</span><textarea name="description" rows={2} placeholder="Краткое описание" defaultValue={module?.description ?? ""} /></label>
    {message && <small className={message.includes("сохран") ? "success-text" : "field-error"}>{message}</small>}
    <button className="button small secondary" disabled={pending}>{module ? <Save aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}{pending ? "Сохраняем…" : module ? "Сохранить модуль" : "Добавить модуль"}</button>
  </form>;
}

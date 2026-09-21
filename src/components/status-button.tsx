"use client";

import { useState, useTransition } from "react";
import { setCourseStatusAction } from "@/app/admin/courses/actions";

export function StatusButton({ courseId, status }: { courseId: string; status: "draft" | "published" | "archived" }) {
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState<string | null>(null);
  const next = status === "published" ? "draft" : "published";
  return <div className="stack compact"><button className="button small" disabled={pending} onClick={() => startTransition(async () => { const result = await setCourseStatusAction(courseId, next); setMessage(result.message); })}>{pending ? "Обновляем…" : status === "published" ? "Вернуть в черновик" : "Опубликовать"}</button>{message && <small>{message}</small>}</div>;
}

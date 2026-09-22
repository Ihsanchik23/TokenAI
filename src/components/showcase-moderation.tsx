"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateShowcaseWorkAction } from "@/app/showcase/actions";

export function ShowcaseModeration({ workId }: { workId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function moderate(decision: "published" | "rejected") {
    setMessage(null);
    startTransition(async () => {
      const result = await moderateShowcaseWorkAction(workId, decision, comment);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="stack compact">
      <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} maxLength={4000} placeholder="Комментарий модератора; обязателен при отклонении" />
      <div className="actions"><button className="button small" type="button" disabled={pending} onClick={() => moderate("published")}>Опубликовать</button><button className="button small secondary" type="button" disabled={pending} onClick={() => moderate("rejected")}>Отклонить</button></div>
      {message && <p className="field-help" aria-live="polite">{message}</p>}
    </div>
  );
}

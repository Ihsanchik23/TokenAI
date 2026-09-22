"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
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
    <div className="moderation-form">
      <label className="field"><span>Комментарий модератора</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={4000} placeholder="Обязателен при отклонении" /></label>
      <div><button className="button small" type="button" disabled={pending} onClick={() => moderate("published")}><Check aria-hidden="true" size={17} />Опубликовать</button><button className="button small secondary" type="button" disabled={pending} onClick={() => moderate("rejected")}><X aria-hidden="true" size={17} />Отклонить</button></div>
      {message && <p className="field-help" aria-live="polite">{message}</p>}
    </div>
  );
}

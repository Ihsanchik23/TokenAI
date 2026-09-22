"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewAssignmentAction } from "@/app/learning/assignment-actions";

export function AdminSubmissionReview({ submissionId, disabled }: { submissionId: string; disabled: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function review(status: "approved" | "needs_revision") {
    setMessage(null);
    startTransition(async () => {
      const result = await reviewAssignmentAction(submissionId, status, comment);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  if (disabled) return <p className="field-help">Проверять можно только последнюю отправленную попытку.</p>;
  return <div className="stack compact"><textarea rows={3} maxLength={4000} placeholder="Комментарий преподавателя" value={comment} onChange={(event) => setComment(event.target.value)} /><div className="actions"><button className="button small" type="button" disabled={pending} onClick={() => review("approved")}>Принять</button><button className="button small secondary" type="button" disabled={pending} onClick={() => review("needs_revision")}>На доработку</button></div>{message && <p className="field-help" aria-live="polite">{message}</p>}</div>;
}

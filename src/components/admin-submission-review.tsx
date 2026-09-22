"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
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
  return <div className="submission-review-form"><label className="field"><span>Комментарий студенту</span><textarea rows={5} maxLength={4000} placeholder="Что получилось и что нужно исправить" value={comment} onChange={(event) => setComment(event.target.value)} /></label><div><button className="button small" type="button" disabled={pending} onClick={() => review("approved")}><Check aria-hidden="true" size={17} />Принять</button><button className="button small secondary" type="button" disabled={pending} onClick={() => review("needs_revision")}><RotateCcw aria-hidden="true" size={17} />На доработку</button></div>{message && <p className="field-help" aria-live="polite">{message}</p>}</div>;
}

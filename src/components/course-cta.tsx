"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enrollFreeAction, startMockCheckoutAction } from "@/app/enrollment/actions";

type Props = {
  courseId: string;
  slug: string;
  accessType: "free" | "paid" | "private";
  authenticated: boolean;
  enrolled: boolean;
};

export function CourseCta({ courseId, slug, accessType, authenticated, enrolled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (enrolled) return <Link className="button" href={`/my-courses/${courseId}`}>Продолжить обучение</Link>;
  if (accessType === "private") return <p className="notice">Доступ к этому курсу выдаёт администратор.</p>;

  const label = accessType === "free" ? "Начать бесплатно" : "Купить курс";
  if (!authenticated) {
    return <Link className="button" href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`}>{label}</Link>;
  }

  return (
    <div className="stack compact">
      <button
        className="button"
        disabled={pending}
        onClick={() => startTransition(async () => {
          setMessage(null);
          const result = accessType === "free"
            ? await enrollFreeAction(courseId)
            : await startMockCheckoutAction(courseId);
          if (!result.ok) setMessage(result.message);
          else if (accessType === "free") router.push("/my-courses");
        })}
      >
        {pending ? "Подождите…" : label}
      </button>
      {message && <p className="notice" role="alert">{message}</p>}
    </div>
  );
}

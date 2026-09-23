"use client";

import Link from "next/link";
import { BookOpen, Play, ShoppingBag } from "lucide-react";
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

export function CatalogCourseAction({ courseId, slug, accessType, authenticated, enrolled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (enrolled) {
    return <Link className="catalog-card-action enrolled" href="/my-courses"><BookOpen aria-hidden="true" size={16} />Открыть</Link>;
  }

  if (accessType === "private") {
    return <Link className="catalog-card-action private" href={`/courses/${slug}`}><BookOpen aria-hidden="true" size={16} />Подробнее</Link>;
  }

  const paid = accessType === "paid";
  const label = paid ? "Купить" : "Начать";
  const Icon = paid ? ShoppingBag : Play;

  if (!authenticated) {
    return <Link className={`catalog-card-action ${paid ? "paid" : "free"}`} href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`}><Icon aria-hidden="true" size={16} />{label}</Link>;
  }

  return (
    <div className="catalog-card-action-wrap">
      <button
        className={`catalog-card-action ${paid ? "paid" : "free"}`}
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => startTransition(async () => {
          setMessage(null);
          const result = paid ? await startMockCheckoutAction(courseId) : await enrollFreeAction(courseId);
          if (!result.ok) setMessage(result.message);
          else if (!paid) router.push("/my-courses");
        })}
      >
        <Icon aria-hidden="true" size={16} />{pending ? "Подождите…" : label}
      </button>
      {message && <small className="catalog-card-action-error" role="alert">{message}</small>}
    </div>
  );
}

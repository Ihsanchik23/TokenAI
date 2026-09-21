import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { confirmMockPaymentAction } from "@/app/enrollment/actions";
import { requireUser } from "@/lib/auth";
import { formatCoursePrice } from "@/lib/course-utils";
import { createClient } from "@/lib/supabase/server";

export default async function MockCheckoutPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ orderId }, query, user] = await Promise.all([params, searchParams, requireUser()]);
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id,user_id,course_id,amount,currency,status,courses(title,slug)").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (!order) notFound();
  if (order.status === "paid") redirect("/my-courses?payment=success");
  const course = order.courses[0];

  return <main className="page-shell narrow-shell"><section className="card stack"><div><p className="eyebrow">Mock payment</p><h1>Подтверждение покупки</h1></div><p className="muted">Это тестовый платёж для MVP. Реальное списание средств не выполняется.</p><div className="order-summary"><span>{course?.title ?? "Курс TokenAI"}</span><strong>{formatCoursePrice("paid", order.amount, order.currency)}</strong></div>{query.error === "payment-failed" && <p className="notice">Не удалось подтвердить платёж. Курс мог стать недоступен — попробуйте ещё раз.</p>}<form action={confirmMockPaymentAction.bind(null, order.id)}><button className="button">Подтвердить mock-оплату</button></form><Link href={course?.slug ? `/courses/${course.slug}` : "/courses"}>Отменить и вернуться</Link></section></main>;
}

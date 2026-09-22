import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, ClipboardCheck, ImageIcon, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const [courses, submissions, showcase] = await Promise.all([
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("showcase_works").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const metrics = [
    { label: "Курсы", value: courses.count ?? 0, href: "/admin/courses", icon: BookOpen },
    { label: "Задания на проверке", value: submissions.count ?? 0, href: "/admin/submissions?status=submitted", icon: ClipboardCheck },
    { label: "Работы на модерации", value: showcase.count ?? 0, href: "/admin/showcase", icon: ImageIcon },
  ];

  return <section className="studio-page studio-overview">
    <header className="studio-page-heading"><div><p className="eyebrow">Рабочая область</p><h1>Обзор</h1><p>Курсы, проверка работ и модерация в одном месте.</p></div><Link className="button" href="/admin/courses/new"><Plus aria-hidden="true" size={18} />Создать курс</Link></header>
    <div className="studio-overview-grid">{metrics.map((metric) => { const Icon = metric.icon; return <Link className="studio-metric" href={metric.href} key={metric.label}><span><Icon aria-hidden="true" size={19} />{metric.label}</span><strong>{metric.value}</strong><ArrowRight aria-hidden="true" size={18} /></Link>; })}</div>
    <section className="studio-quick-section"><div className="studio-section-heading"><div><p className="eyebrow">Быстрый старт</p><h2>Что требует внимания</h2></div></div><div className="studio-quick-list"><Link href="/admin/submissions?status=submitted"><ClipboardCheck aria-hidden="true" size={21} /><span><strong>Проверить задания</strong><small>{submissions.count ? `${submissions.count} ждут решения` : "Новых отправок нет"}</small></span><ArrowRight aria-hidden="true" size={18} /></Link><Link href="/admin/showcase"><ImageIcon aria-hidden="true" size={21} /><span><strong>Модерировать Showcase</strong><small>{showcase.count ? `${showcase.count} ждут публикации` : "Очередь пуста"}</small></span><ArrowRight aria-hidden="true" size={18} /></Link><Link href="/admin/analytics"><BarChart3 aria-hidden="true" size={21} /><span><strong>Открыть аналитику</strong><small>Прогресс и показатели доступных курсов</small></span><ArrowRight aria-hidden="true" size={18} /></Link></div></section>
  </section>;
}

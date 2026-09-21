import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { count } = await supabase.from("courses").select("id", { count: "exact", head: true });
  return <section className="stack roomy"><div className="placeholder-grid"><article className="card stack compact"><p className="eyebrow">Курсы</p><h2>{count ?? 0}</h2><Link href="/admin/courses">Управлять курсами</Link></article><article className="card stack compact"><p className="eyebrow">Phase 4</p><h2>Конструктор готов</h2><p className="muted">Модули, уроки и публикация.</p></article><article className="card stack compact"><p className="eyebrow">Далее</p><h2>Учащиеся</h2><p className="muted">Прогресс появится в следующей фазе.</p></article></div></section>;
}

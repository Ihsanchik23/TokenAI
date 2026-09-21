import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  ensureMyProfile,
  getMyProfile,
  isProfileComplete,
} from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function MyCoursesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  await ensureMyProfile(supabase);
  const profile = await getMyProfile(supabase, user.id);

  if (!profile || !isProfileComplete(profile)) {
    redirect("/onboarding");
  }

  return (
    <main className="page-shell narrow-shell">
      <section className="card stack">
        <p className="eyebrow">Мои курсы</p>
        <h1>Курсов пока нет</h1>
        <p className="muted">
          Этот защищённый маршрут подготовлен для следующего этапа. Курсы и
          enrollment здесь ещё не реализованы.
        </p>
      </section>
    </main>
  );
}

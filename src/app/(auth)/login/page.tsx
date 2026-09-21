import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getOptionalUser } from "@/lib/auth";

const messages: Record<string, string> = {
  "auth-required": "Войдите, чтобы открыть эту страницу.",
  "signed-out": "Вы вышли из аккаунта.",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { message, next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/profile";
  const user = await getOptionalUser();

  if (user) {
    redirect(nextPath);
  }

  const notice = messages[typeof message === "string" ? message : ""];

  return (
    <main className="page-shell narrow-shell">
      <section className="card stack">
        <div>
          <p className="eyebrow">TokenAI</p>
          <h1>Вход</h1>
          <p className="muted">Продолжите обучение и работу с профилем.</p>
        </div>
        {notice && <p className="notice success">{notice}</p>}
        <AuthForm mode="login" nextPath={nextPath} />
      </section>
    </main>
  );
}

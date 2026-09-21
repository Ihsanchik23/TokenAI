import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getOptionalUser } from "@/lib/auth";

export default async function SignupPage() {
  const user = await getOptionalUser();

  if (user) {
    redirect("/profile");
  }

  return (
    <main className="page-shell narrow-shell">
      <section className="card stack">
        <div>
          <p className="eyebrow">TokenAI</p>
          <h1>Регистрация</h1>
          <p className="muted">
            Создайте аккаунт. После регистрации подтвердите email.
          </p>
        </div>
        <AuthForm mode="signup" />
      </section>
    </main>
  );
}

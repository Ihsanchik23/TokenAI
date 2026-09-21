import Link from "next/link";

const errorMessages: Record<string, string> = {
  "invalid-or-expired":
    "Ссылка подтверждения недействительна или уже истекла. Запросите новую ссылку или попробуйте войти.",
  profile:
    "Вход выполнен, но профиль не удалось подготовить. Попробуйте войти ещё раз.",
};

export default async function AuthErrorPage({
  searchParams,
}: PageProps<"/auth/error">) {
  const { reason } = await searchParams;
  const message =
    errorMessages[typeof reason === "string" ? reason : ""] ??
    "Не удалось завершить авторизацию.";

  return (
    <main className="page-shell narrow-shell">
      <section className="card stack">
        <p className="eyebrow">Авторизация</p>
        <h1>Ссылка не сработала</h1>
        <p className="muted">{message}</p>
        <div className="actions">
          <Link className="button" href="/login">
            Перейти ко входу
          </Link>
          <Link className="button secondary" href="/signup">
            Зарегистрироваться снова
          </Link>
        </div>
      </section>
    </main>
  );
}

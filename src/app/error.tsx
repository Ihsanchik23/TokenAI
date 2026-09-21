"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell narrow-shell">
      <section className="card stack">
        <p className="eyebrow">TokenAI</p>
        <h1>Не удалось загрузить страницу</h1>
        <p className="muted">
          Проверьте подключение и повторите попытку. Технические детали скрыты.
        </p>
        <button className="button" type="button" onClick={reset}>
          Попробовать снова
        </button>
      </section>
    </main>
  );
}

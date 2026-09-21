import Link from "next/link";

export default function Home() {
  return (
    <main className="hero page-shell">
      <section className="hero-copy stack">
        <p className="eyebrow">Учитесь создавать с AI</p>
        <h1>TokenAI — практическое обучение AI-инструментам</h1>
        <p className="hero-text">
          Создайте профиль, выберите интересы и подготовьтесь к первым курсам.
        </p>
        <div className="actions">
          <Link className="button" href="/signup">
            Начать бесплатно
          </Link>
          <Link className="button secondary" href="/login">
            Войти
          </Link>
        </div>
      </section>
      <section className="hero-panel card stack">
        <p className="eyebrow">Phase 3</p>
        <h2>Ваш профиль обучения</h2>
        <p className="muted">
          Выберите направления: AI Video, AI Design, Vibe Coding, Automation и другие.
        </p>
      </section>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { getOptionalUser } from "@/lib/auth";
import { getCourseCoverUrl } from "@/lib/course-utils";
import { getLearningState } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";

async function getContinueCourse() {
  const user = await getOptionalUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id,started_at,expires_at,course:courses(slug,title,cover_path)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .not("started_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(5);
  const enrollment = (enrollments ?? []).find((item) => !item.expires_at || new Date(item.expires_at) > new Date());
  const course = enrollment?.course[0];
  if (!course) return null;
  const state = await getLearningState(course.slug, user.id);
  if (!state || state.learningComplete) return null;
  const lesson = state.continueLesson;
  const courseModule = lesson ? state.modules.find((item) => item.id === lesson.moduleId) : null;
  return { course, state, lesson, courseModule };
}

const faqs = [
  { question: "Кому подходит TokenAI?", answer: "Тем, кто хочет осваивать AI-инструменты через последовательные уроки и практические задания — от первого знакомства до законченных работ." },
  { question: "Как проходит обучение?", answer: "Вы проходите теорию и видео, выполняете тесты и задания, а прогресс сохраняется в вашем профиле. К следующему обязательному уроку можно перейти после завершения текущего." },
  { question: "Когда появляется сертификат?", answer: "После выполнения всех обязательных условий курса. Если в программе есть проверяемые задания, сертификат станет доступен после их одобрения преподавателем." },
] as const;

export default async function Home() {
  const continuing = await getContinueCourse();
  const cover = continuing ? getCourseCoverUrl(continuing.course.cover_path) : null;

  return (
    <main className="home-page">
      <section className="home-hero page-shell">
        <div className="home-hero-copy">
          <p className="eyebrow"><Sparkles aria-hidden="true" size={14} />Практическое обучение AI</p>
          <h1>Осваивайте AI.<br />Создавайте настоящее.</h1>
          <p className="hero-text">Курсы по современным AI-инструментам, в которых теория сразу превращается в практику и готовые работы.</p>
          <div className="actions">
            <Link className="button" href="/courses">Смотреть курсы<ArrowRight aria-hidden="true" size={18} /></Link>
            <Link className="button ghost" href="/students">Работы сообщества</Link>
          </div>
        </div>
        <div className="home-hero-visual" aria-label="Учебный процесс TokenAI">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-ai-mark">AI<span>→</span></div>
          <div className="hero-learning-strip">
            <span><Check aria-hidden="true" size={15} />Смотрите</span>
            <span><Check aria-hidden="true" size={15} />Практикуйтесь</span>
            <span><Check aria-hidden="true" size={15} />Создавайте</span>
          </div>
        </div>
      </section>

      {continuing && (
        <section className="page-shell home-continue-section" aria-labelledby="continue-heading">
          <div className="section-heading-inline"><div><p className="eyebrow">Вернуться к обучению</p><h2 id="continue-heading">Продолжить с того же места</h2></div></div>
          <article className="continue-learning-block">
            <div className="continue-cover">
              {cover ? <Image src={cover} alt={`Обложка курса «${continuing.course.title}»`} fill sizes="(max-width: 700px) 100vw, 320px" /> : <div className="cover-placeholder">TokenAI</div>}
            </div>
            <div className="continue-copy">
              <p className="meta-label">{continuing.courseModule ? `Модуль ${continuing.courseModule.position}` : "Курс"}</p>
              <h3>{continuing.course.title}</h3>
              {continuing.lesson && <p className="muted">Далее: {continuing.lesson.title}</p>}
              <div className="continue-progress"><div className="progress-track"><span style={{ width: `${continuing.state.progressPercent}%` }} /></div><span>{continuing.state.progressPercent}%</span></div>
            </div>
            <Link className="button" href={`/learn/${continuing.course.slug}`}>Продолжить<ArrowRight aria-hidden="true" size={18} /></Link>
          </article>
        </section>
      )}

      <section className="home-story page-shell" aria-labelledby="about-heading">
        <div className="home-section-index">01</div>
        <div className="home-story-copy">
          <p className="eyebrow">Что такое TokenAI</p>
          <h2 id="about-heading">Не библиотека лекций.<br />Среда для практики.</h2>
          <p>TokenAI объединяет структурированные уроки, проверку знаний и практические задания в одном учебном маршруте. Вы видите прогресс, возвращаетесь к текущему уроку и собираете результаты обучения в профиле.</p>
        </div>
        <div className="home-process" aria-label="Этапы обучения">
          <div><span>01</span><strong>Изучить</strong><p>Короткая теория и видео без лишнего.</p></div>
          <div><span>02</span><strong>Применить</strong><p>Тесты и задания внутри курса.</p></div>
          <div><span>03</span><strong>Завершить</strong><p>Прогресс, обратная связь и сертификат.</p></div>
        </div>
      </section>

      <section className="founders-section page-shell" aria-labelledby="founders-heading">
        <div className="home-section-index">02</div>
        <div className="founders-heading"><p className="eyebrow">Основатели</p><h2 id="founders-heading">Люди за TokenAI</h2></div>
        <div className="founders-placeholder">
          <div className="founders-monogram" aria-hidden="true">T</div>
          <p>Раздел подготовлен для официальной информации об основателях. Персональные данные появятся после публикации командой TokenAI.</p>
        </div>
      </section>

      <section className="faq-section page-shell" aria-labelledby="faq-heading">
        <div className="home-section-index">03</div>
        <div><p className="eyebrow">FAQ</p><h2 id="faq-heading">Частые вопросы</h2></div>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <details key={faq.question} open={index === 0}>
              <summary><span>{faq.question}</span><span aria-hidden="true">+</span></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <div><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">T</span><span>TokenAI</span></Link><p>Практическое обучение AI-инструментам.</p></div>
          <nav aria-label="Навигация в подвале"><Link href="/courses">Каталог</Link><Link href="/my-courses">Мои курсы</Link><Link href="/students">Студенты</Link></nav>
          <span>© {new Date().getFullYear()} TokenAI</span>
        </div>
      </footer>
    </main>
  );
}

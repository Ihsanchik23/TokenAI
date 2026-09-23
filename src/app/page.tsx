import Image from "next/image";
import Link from "next/link";
import { ArrowRight, AtSign } from "lucide-react";
import { getOptionalUser } from "@/lib/auth";
import { getCourseCoverUrl } from "@/lib/course-utils";
import { getLearningState } from "@/lib/learning";
import { createClient } from "@/lib/supabase/server";

async function getContinueCourse(user: Awaited<ReturnType<typeof getOptionalUser>>) {
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
  { question: "Нужно ли уже разбираться в ИИ, чтобы начать обучение?", answer: "Нет. Курсы TokenAI рассчитаны так, чтобы вы могли начать с базового уровня и постепенно перейти к реальному применению AI-инструментов в работе и проектах." },
] as const;

export default async function Home() {
  const user = await getOptionalUser();
  const continuing = await getContinueCourse(user);
  const cover = continuing ? getCourseCoverUrl(continuing.course.cover_path) : null;
  const homeMediaUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-assets/home`;

  return (
    <main className="home-page">
      <section className="home-video-hero" aria-labelledby="home-hero-heading">
        <video className="home-hero-video" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
          <source src={`${homeMediaUrl}/hero-mobile.mp4`} media="(max-width: 700px)" type="video/mp4" />
          <source src={`${homeMediaUrl}/hero-desktop.mp4`} type="video/mp4" />
        </video>
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-content page-shell">
          <div className="home-hero-copy">
            <h1 id="home-hero-heading">Используйте ИИ правильно</h1>
            <p>Курсы по современным AI-инструментам, которые обучат вас как использовать их в работе.</p>
            <div className="home-hero-actions">
              <Link className="button" href="/courses">Смотреть курсы<ArrowRight aria-hidden="true" size={18} /></Link>
              {!user && <Link className="button secondary home-login-button" href="/login">Войти</Link>}
            </div>
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

      <section className="home-description page-shell" aria-labelledby="about-heading">
        <div className="home-description-heading">
          <p className="eyebrow">Что такое TokenAI</p>
          <h2 id="about-heading">Платформа курсов<br className="home-description-break" />&nbsp;по <span>искусственному интеллекту.</span></h2>
        </div>
        <div className="home-description-copy">
          <p>TokenAI объединяет теорию, практические задания, тесты и видеоуроки, чтобы обучение превращалось в реальный навык.</p>
          <p>ИИ не сделает работу за человека. <strong>ИИ — это инструмент.</strong> Мы помогаем понять, как применять AI-инструменты в работе, проектах и настоящих задачах.</p>
        </div>
      </section>

      <section className="creators-section page-shell" aria-labelledby="creators-heading">
        <div className="creators-heading">
          <p className="eyebrow">Авторы TokenAI</p>
          <h2 id="creators-heading">Люди ТокенИИ</h2>
          <div className="creator-links" aria-label="Instagram авторов TokenAI">
            <a className="button secondary" href="https://www.instagram.com/iwpusqanda/" target="_blank" rel="noreferrer">
              <AtSign aria-hidden="true" size={16} />iwpusqanda
            </a>
            <a className="button secondary" href="https://www.instagram.com/farkhadooov/" target="_blank" rel="noreferrer">
              <AtSign aria-hidden="true" size={16} />farkhadooov
            </a>
          </div>
        </div>
        <div className="creators-stage">
          <div className="creator-glow creator-glow-one" aria-hidden="true" />
          <div className="creator-glow creator-glow-two" aria-hidden="true" />
          <Image className="creator-card creator-card-one" src="/home/creator-ish.png" alt="Instagram-карточка создателя TokenAI" width={882} height={1290} sizes="(max-width: 700px) 54vw, (max-width: 1100px) 34vw, 310px" />
          <Image className="creator-card creator-card-two" src="/home/creator-ya.png" alt="Instagram-карточка создателя TokenAI" width={882} height={1290} sizes="(max-width: 700px) 54vw, (max-width: 1100px) 34vw, 310px" />
        </div>
      </section>

      <section className="faq-section page-shell" aria-labelledby="faq-heading">
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

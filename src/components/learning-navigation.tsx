"use client";

import Link from "next/link";
import { ArrowLeft, Check, Circle, ListTree, LockKeyhole, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Lesson = {
  id: string;
  title: string;
  state: "locked" | "available" | "completed";
};

type Module = { id: string; title: string; position: number; lessons: Lesson[] };

function Curriculum({ courseSlug, currentLessonId, modules }: { courseSlug: string; currentLessonId: string; modules: Module[] }) {
  return (
    <div className="player-curriculum">
      {modules.map((courseModule) => (
        <section className="curriculum-module" key={courseModule.id}>
          <p><span>{String(courseModule.position).padStart(2, "0")}</span>{courseModule.title}</p>
          <div>
            {courseModule.lessons.map((item) => {
              const current = item.id === currentLessonId;
              const Icon = item.state === "completed" ? Check : item.state === "locked" ? LockKeyhole : Circle;
              return item.state === "locked" ? (
                <span className="curriculum-link locked" key={item.id}><Icon aria-hidden="true" size={15} />{item.title}</span>
              ) : (
                <Link className={`curriculum-link${current ? " current" : ""}`} aria-current={current ? "page" : undefined} href={`/learn/${courseSlug}/${item.id}`} key={item.id}>
                  <Icon aria-hidden="true" size={15} />{item.title}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function LearningNavigation({ courseSlug, courseTitle, currentLessonId, modules, progressPercent, progressLabel }: {
  courseSlug: string;
  courseTitle: string;
  currentLessonId: string;
  modules: Module[];
  progressPercent: number;
  progressLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const progress = <><div className="player-progress-copy"><span>{progressPercent}% пройдено</span><span>{progressLabel}</span></div><div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div></>;

  return (
    <>
      <div className="mobile-player-bar">
        <Link href="/my-courses" aria-label="Вернуться к моим курсам"><ArrowLeft aria-hidden="true" size={20} /></Link>
        <span>{courseTitle}</span>
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-label="Открыть программу курса" aria-expanded={open}><ListTree aria-hidden="true" size={20} /></button>
      </div>
      <aside className="learning-sidebar">
        <Link className="player-back-link" href="/my-courses"><ArrowLeft aria-hidden="true" size={17} />Мои курсы</Link>
        <div className="player-course-heading"><p className="eyebrow">Программа</p><h2>{courseTitle}</h2>{progress}</div>
        <Curriculum courseSlug={courseSlug} currentLessonId={currentLessonId} modules={modules} />
      </aside>
      {open && (
        <div className="sheet-backdrop learning-sheet-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div className="learning-sheet" role="dialog" aria-modal="true" aria-label="Программа курса" ref={panelRef} tabIndex={-1}>
            <header className="sheet-header">
              <div className="stack compact"><p className="eyebrow">Программа</p><h2>{courseTitle}</h2></div>
              <button className="utility-button" type="button" onClick={() => setOpen(false)} aria-label="Закрыть программу"><X aria-hidden="true" size={20} /></button>
            </header>
            <div className="mobile-player-progress">{progress}</div>
            <div onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}>
              <Curriculum courseSlug={courseSlug} currentLessonId={currentLessonId} modules={modules} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

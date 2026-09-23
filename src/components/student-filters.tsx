"use client";

import Link from "next/link";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

type Topic = { id: string; name: string; slug: string };

export function StudentFilters({ topics, query, selectedTopics }: { topics: Topic[]; query: string; selectedTopics: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draftQuery, setDraftQuery] = useState(query);
  const [draftTopics, setDraftTopics] = useState(selectedTopics);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeFilterCount = (query ? 1 : 0) + selectedTopics.length;

  function toggleTopic(slug: string) {
    setDraftTopics((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (draftQuery.trim()) params.set("q", draftQuery.trim());
    draftTopics.forEach((topic) => params.append("topic", topic));
    setOpen(false);
    const value = params.toString();
    router.push(value ? `/students?${value}` : "/students");
  }

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
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type="hidden"]), [tabindex]:not([tabindex="-1"])'));
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

  return (
    <section className="catalog-controls" aria-label="Поиск и фильтры студентов">
      <button ref={triggerRef} className="button secondary catalog-filter-trigger" type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="student-filter-panel">
        <SlidersHorizontal aria-hidden="true" size={18} />
        Фильтры{activeFilterCount ? <span>{activeFilterCount}</span> : null}
      </button>

      {open && (
        <div className="catalog-filter-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div id="student-filter-panel" className="catalog-filter-panel student-filter-panel" role="dialog" aria-modal="true" aria-labelledby="student-filter-title" ref={panelRef} tabIndex={-1}>
            <header className="catalog-filter-header">
              <div><p className="eyebrow">Студенты</p><h2 id="student-filter-title">Найти участника</h2></div>
              <button className="utility-button" type="button" onClick={() => setOpen(false)} aria-label="Закрыть фильтры"><X aria-hidden="true" size={20} /></button>
            </header>

            <form className="catalog-filter-form" onSubmit={applyFilters}>
              <label className="catalog-filter-search">
                <span>Поиск</span>
                <span className="catalog-filter-search-control"><Search aria-hidden="true" size={18} /><input name="q" placeholder="Имя или фамилия" maxLength={80} value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} /></span>
              </label>

              <fieldset className="catalog-filter-group student-topic-filter">
                <legend>Направления</legend>
                <div className="catalog-filter-options">
                  {topics.map((topic) => (
                    <label className="catalog-filter-option" key={topic.id}>
                      <input type="checkbox" name="topic" value={topic.slug} checked={draftTopics.includes(topic.slug)} onChange={() => toggleTopic(topic.slug)} />
                      <span><Check aria-hidden="true" size={14} />{topic.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="catalog-filter-actions">
                <Link className="button secondary" href="/students" onClick={() => setOpen(false)}>Сбросить</Link>
                <button className="button" type="submit">Применить<Search aria-hidden="true" size={17} /></button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

export function MyCoursesControls({ query, status }: { query: string; status: "active" | "completed" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);
  const [draftStatus, setDraftStatus] = useState(status);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function buildHref(search: string, nextStatus: "active" | "completed") {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (nextStatus === "completed") params.set("status", "completed");
    const value = params.toString();
    return value ? `/my-courses?${value}` : "/my-courses";
  }

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpen(false);
    router.push(buildHref(searchQuery, draftStatus));
  }

  useEffect(() => {
    if (searchQuery.trim() === query.trim()) return;
    const timeout = window.setTimeout(() => router.replace(buildHref(searchQuery, status)), 280);
    return () => window.clearTimeout(timeout);
  }, [query, router, searchQuery, status]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <section className="search-filter-controls" aria-label="Поиск и фильтры моих курсов">
      <label className="live-search-control">
        <Search aria-hidden="true" size={18} />
        <span className="visually-hidden">Поиск среди моих курсов</span>
        <input name="q" placeholder="Найти курс" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
      </label>
      <button ref={triggerRef} className="icon-filter-trigger" type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="my-courses-filter-panel" aria-label="Открыть фильтры">
        <SlidersHorizontal aria-hidden="true" size={19} />
      </button>

      {open && (
        <div className="catalog-filter-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div id="my-courses-filter-panel" className="catalog-filter-panel student-filter-panel" role="dialog" aria-modal="true" aria-labelledby="my-courses-filter-title" ref={panelRef} tabIndex={-1}>
            <header className="catalog-filter-header">
              <div><p className="eyebrow">Мои курсы</p><h2 id="my-courses-filter-title">Статус курса</h2></div>
              <button className="utility-button" type="button" onClick={() => setOpen(false)} aria-label="Закрыть фильтры"><X aria-hidden="true" size={20} /></button>
            </header>
            <form className="catalog-filter-form" onSubmit={applyFilter}>
              <fieldset className="catalog-filter-group">
                <legend>Показывать</legend>
                <div className="catalog-filter-options">
                  {([{"label":"Активные","value":"active"},{"label":"Завершённые","value":"completed"}] as const).map((option) => (
                    <label className="catalog-filter-option" key={option.value}>
                      <input type="radio" name="status" value={option.value} checked={draftStatus === option.value} onChange={() => setDraftStatus(option.value)} />
                      <span><Check aria-hidden="true" size={14} />{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="catalog-filter-actions">
                <Link className="button secondary" href={query.trim() ? `/my-courses?q=${encodeURIComponent(query.trim())}` : "/my-courses"} onClick={() => setOpen(false)}>Сбросить</Link>
                <button className="button" type="submit">Применить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

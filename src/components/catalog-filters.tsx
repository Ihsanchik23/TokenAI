"use client";

import Link from "next/link";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Filters = {
  q?: string;
  topic?: string;
  level?: string;
  access?: string;
  sort?: string;
};

type Topic = { id: string; name: string; slug: string };

function filterHref(filters: Filters, topic: string) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (topic) params.set("topic", topic);
  if (filters.level) params.set("level", filters.level);
  if (filters.access) params.set("access", filters.access);
  if (filters.sort && filters.sort !== "newest") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `/courses?${query}` : "/courses";
}

export function CatalogFilters({ topics, filters }: { topics: Topic[]; filters: Filters }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeFilterCount = [filters.topic, filters.level, filters.access, filters.sort && filters.sort !== "newest"].filter(Boolean).length;

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
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])'));
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

  const advancedFields = (
    <>
      <label className="field">
        <span>Тема</span>
        <select name="topic" defaultValue={filters.topic ?? ""}>
          <option value="">Все темы</option>
          {topics.map((topic) => <option value={topic.slug} key={topic.id}>{topic.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Уровень</span>
        <select name="level" defaultValue={filters.level ?? ""}>
          <option value="">Все уровни</option>
          <option value="beginner">Начальный</option>
          <option value="intermediate">Средний</option>
          <option value="advanced">Продвинутый</option>
        </select>
      </label>
      <label className="field">
        <span>Доступ</span>
        <select name="access" defaultValue={filters.access ?? ""}>
          <option value="">Любой доступ</option>
          <option value="free">Бесплатный</option>
          <option value="paid">Платный</option>
          <option value="private">Закрытый</option>
        </select>
      </label>
      <label className="field">
        <span>Сортировка</span>
        <select name="sort" defaultValue={filters.sort ?? "newest"}>
          <option value="newest">Сначала новые</option>
          <option value="title">По названию</option>
        </select>
      </label>
    </>
  );

  return (
    <section className="catalog-controls" aria-label="Поиск и фильтры курсов">
      <form className="catalog-search" role="search">
        <Search aria-hidden="true" size={19} />
        <label className="visually-hidden" htmlFor="mobile-course-search">Найти курс</label>
        <input id="mobile-course-search" name="q" placeholder="Найти курс" defaultValue={filters.q ?? ""} />
        {filters.topic && <input type="hidden" name="topic" value={filters.topic} />}
        {filters.level && <input type="hidden" name="level" value={filters.level} />}
        {filters.access && <input type="hidden" name="access" value={filters.access} />}
        {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}
        <button className="button icon" aria-label="Искать" type="submit"><Search aria-hidden="true" size={18} /></button>
      </form>

      <div className="topic-chip-row" aria-label="Темы курсов">
        <Link className={!filters.topic ? "active" : undefined} href={filterHref(filters, "")} aria-current={!filters.topic ? "page" : undefined}>Все</Link>
        {topics.map((topic) => <Link className={filters.topic === topic.slug ? "active" : undefined} href={filterHref(filters, topic.slug)} aria-current={filters.topic === topic.slug ? "page" : undefined} key={topic.id}>{topic.name}</Link>)}
      </div>

      <button ref={triggerRef} className="button secondary mobile-filter-button" type="button" onClick={() => setOpen(true)} aria-expanded={open}>
        <SlidersHorizontal aria-hidden="true" size={18} />
        Фильтры{activeFilterCount ? ` · ${activeFilterCount}` : ""}
      </button>

      <form className="desktop-catalog-filters">
        <label className="catalog-search desktop-search">
          <Search aria-hidden="true" size={19} />
          <span className="visually-hidden">Найти курс</span>
          <input name="q" placeholder="Найти курс" defaultValue={filters.q ?? ""} />
        </label>
        {advancedFields}
        <button className="button" type="submit">Применить</button>
      </form>

      {open && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div className="filter-sheet" role="dialog" aria-modal="true" aria-label="Фильтры каталога" ref={panelRef} tabIndex={-1}>
            <header className="sheet-header">
              <div><p className="eyebrow">Каталог</p><h2>Фильтры</h2></div>
              <button className="utility-button" type="button" onClick={() => setOpen(false)} aria-label="Закрыть фильтры"><X aria-hidden="true" size={20} /></button>
            </header>
            <form className="filter-sheet-form">
              {filters.q && <input type="hidden" name="q" value={filters.q} />}
              {advancedFields}
              <div className="sheet-actions">
                <Link className="button secondary" href={filters.q ? `/courses?q=${encodeURIComponent(filters.q)}` : "/courses"}>Сбросить</Link>
                <button className="button" type="submit">Показать курсы</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

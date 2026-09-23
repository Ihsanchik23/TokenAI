"use client";

import Link from "next/link";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

type Filters = {
  q?: string;
  topic?: string;
  level?: string;
  access?: string;
  sort?: string;
};

type Topic = { id: string; name: string; slug: string };
type FilterOption = { label: string; value: string };

function FilterGroup({ legend, name, options, value, onChange }: { legend: string; name: string; options: FilterOption[]; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="catalog-filter-group">
      <legend>{legend}</legend>
      <div className="catalog-filter-options">
        {options.map((option) => (
          <label className="catalog-filter-option" key={option.value || "all"}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span><Check aria-hidden="true" size={14} />{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CatalogFilters({ topics, filters }: { topics: Topic[]; filters: Filters }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    q: filters.q ?? "",
    topic: filters.topic ?? "",
    level: filters.level ?? "",
    access: filters.access ?? "",
    sort: filters.sort ?? "newest",
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeFilterCount = [filters.q, filters.topic, filters.level, filters.access, filters.sort && filters.sort !== "newest"].filter(Boolean).length;
  const formKey = [filters.q, filters.topic, filters.level, filters.access, filters.sort].join("|");

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (draft.q.trim()) params.set("q", draft.q.trim());
    if (draft.topic) params.set("topic", draft.topic);
    if (draft.level) params.set("level", draft.level);
    if (draft.access) params.set("access", draft.access);
    if (draft.sort !== "newest") params.set("sort", draft.sort);
    setOpen(false);
    const query = params.toString();
    router.push(query ? `/courses?${query}` : "/courses");
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
    <section className="catalog-controls" aria-label="Поиск и фильтры курсов">
      <button
        ref={triggerRef}
        className="button secondary catalog-filter-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="catalog-filter-panel"
      >
        <SlidersHorizontal aria-hidden="true" size={18} />
        Фильтры{activeFilterCount ? <span>{activeFilterCount}</span> : null}
      </button>

      {open && (
        <div className="catalog-filter-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div id="catalog-filter-panel" className="catalog-filter-panel" role="dialog" aria-modal="true" aria-labelledby="catalog-filter-title" ref={panelRef} tabIndex={-1}>
            <header className="catalog-filter-header">
              <div><p className="eyebrow">Каталог</p><h2 id="catalog-filter-title">Найти курс</h2></div>
              <button className="utility-button" type="button" onClick={() => setOpen(false)} aria-label="Закрыть фильтры"><X aria-hidden="true" size={20} /></button>
            </header>

            <form key={formKey} className="catalog-filter-form" onSubmit={applyFilters}>
              <label className="catalog-filter-search">
                <span>Поиск</span>
                <span className="catalog-filter-search-control"><Search aria-hidden="true" size={18} /><input name="q" placeholder="Название курса" value={draft.q} onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))} /></span>
              </label>

              <div className="catalog-filter-grid">
                <FilterGroup
                  legend="Тема"
                  name="topic"
                  value={draft.topic}
                  onChange={(topic) => setDraft((current) => ({ ...current, topic }))}
                  options={[{ label: "Все темы", value: "" }, ...topics.map((topic) => ({ label: topic.name, value: topic.slug }))]}
                />
                <FilterGroup
                  legend="Уровень"
                  name="level"
                  value={draft.level}
                  onChange={(level) => setDraft((current) => ({ ...current, level }))}
                  options={[{ label: "Все уровни", value: "" }, { label: "Начальный", value: "beginner" }, { label: "Средний", value: "intermediate" }, { label: "Продвинутый", value: "advanced" }]}
                />
                <FilterGroup
                  legend="Доступ"
                  name="access"
                  value={draft.access}
                  onChange={(access) => setDraft((current) => ({ ...current, access }))}
                  options={[{ label: "Любой", value: "" }, { label: "Бесплатный", value: "free" }, { label: "Платный", value: "paid" }, { label: "Закрытый", value: "private" }]}
                />
                <FilterGroup
                  legend="Сортировка"
                  name="sort"
                  value={draft.sort}
                  onChange={(sort) => setDraft((current) => ({ ...current, sort }))}
                  options={[{ label: "Сначала новые", value: "newest" }, { label: "По названию", value: "title" }]}
                />
              </div>

              <div className="catalog-filter-actions">
                <Link className="button secondary" href="/courses" onClick={() => setOpen(false)}>Сбросить</Link>
                <button className="button" type="submit">Применить<Search aria-hidden="true" size={17} /></button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

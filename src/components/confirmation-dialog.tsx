"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({ open, title, description, confirmLabel = "Подтвердить", pending = false, danger = false, onCancel, onConfirm }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) { onCancel(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"));
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, pending, onCancel]);

  if (!open) return null;
  return <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel(); }}>
    <section ref={dialogRef} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <div><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p></div>
      <footer><button className="button secondary" type="button" onClick={onCancel} disabled={pending}>Отмена</button><button ref={confirmRef} className={`button${danger ? " danger-button" : ""}`} type="button" onClick={onConfirm} disabled={pending}>{pending ? "Выполняем…" : confirmLabel}</button></footer>
    </section>
  </div>;
}

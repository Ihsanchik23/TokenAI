"use client";

import { useState } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";

export function ConfirmButton({ children, message }: { children: React.ReactNode; message: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button className="link-button danger" type="button" onClick={() => setOpen(true)}>{children}</button>
    <ConfirmationDialog open={open} title="Подтвердите действие" description={message} confirmLabel="Продолжить" danger onCancel={() => setOpen(false)} onConfirm={() => { setOpen(false); const form = document.activeElement?.closest("form") ?? null; if (form instanceof HTMLFormElement) form.requestSubmit(); }} />
  </>;
}

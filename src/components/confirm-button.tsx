"use client";

export function ConfirmButton({ children, message }: { children: React.ReactNode; message: string }) {
  return (
    <button
      className="link-button danger"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

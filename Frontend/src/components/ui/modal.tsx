"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { scrollFieldIntoView } from "@/components/system/keyboard-inset";

export function Modal({
  open,
  title,
  children,
  onClose,
  onSubmit,
  footer,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    const onFocus = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && panelRef.current?.contains(t)) {
        scrollFieldIntoView(t);
      }
    };
    document.addEventListener("focusin", onFocus);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.();
  }

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      style={{
        maxHeight:
          "min(92dvh, calc(100dvh - var(--kb-inset, 0px) - 1.25rem))",
      }}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <h2
          id="modal-title"
          className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]"
        >
          {title}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          ✕
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
        {children}
      </div>
      {footer ? (
        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--line)] bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex justify-center p-3 sm:items-center"
      style={{
        bottom: "var(--kb-inset, 0px)",
        alignItems: "flex-end",
      }}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      {onSubmit ? (
        <form
          className="relative z-10 w-full max-w-lg"
          onSubmit={handleSubmit}
        >
          {panel}
        </form>
      ) : (
        panel
      )}
    </div>
  );
}

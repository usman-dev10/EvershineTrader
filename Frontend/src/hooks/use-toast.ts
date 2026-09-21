"use client";

import { useCallback, useState } from "react";

export type ToastKind = "success" | "error" | "info";

export interface ToastState {
  kind: ToastKind;
  message: string;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((kind: ToastKind, message: string) => {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const clear = useCallback(() => setToast(null), []);

  return { toast, show, clear };
}

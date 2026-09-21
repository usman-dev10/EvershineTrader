import { cn } from "@/lib/utils";
import type { ToastState } from "@/hooks/use-toast";

export function ToastBanner({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-4 right-4 z-50 max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg",
        toast.kind === "success" && "bg-emerald-700 text-white",
        toast.kind === "error" && "bg-rose-700 text-white",
        toast.kind === "info" && "bg-slate-800 text-white",
      )}
    >
      {toast.message}
    </div>
  );
}

export function AlertBanner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-900",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
        tone === "error" && "border-rose-200 bg-rose-50 text-rose-900",
      )}
    >
      {children}
    </div>
  );
}

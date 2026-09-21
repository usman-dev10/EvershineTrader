import { cn } from "@/lib/utils";

type BadgeTone = "success" | "neutral" | "danger" | "warning" | "info";

const tones: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  danger: "bg-rose-50 text-rose-800 ring-rose-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(
  status: string,
): BadgeTone {
  if (status === "open" || status === "active" || status === "on") return "success";
  if (status === "closed" || status === "inactive" || status === "off") return "neutral";
  if (status === "cancelled") return "danger";
  if (status === "completed") return "info";
  return "neutral";
}

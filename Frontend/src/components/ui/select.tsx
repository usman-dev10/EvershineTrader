import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export function Select({
  id,
  label,
  options,
  error,
  placeholder = "Select…",
  className,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <select
        id={selectId}
        className={cn(
          "h-11 rounded-lg border border-[var(--line)] bg-white px-3 text-[var(--ink)]",
          "focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20",
          error && "border-[var(--danger)]",
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
    </label>
  );
}

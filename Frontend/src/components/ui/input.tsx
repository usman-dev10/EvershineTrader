"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({
  id,
  label,
  error,
  hint,
  className,
  type = "text",
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const resolvedType = isPassword && showPassword ? "text" : type;

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      <span className="font-medium text-[var(--ink)]">{label}</span>
      <div className="relative">
        <input
          id={inputId}
          type={resolvedType}
          className={cn(
            "h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[var(--ink)]",
            "placeholder:text-[var(--muted)]",
            "focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20",
            error && "border-[var(--danger)] focus:ring-[var(--danger)]/20",
            isPassword && "pr-16",
            className,
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs font-medium text-[var(--brand)] hover:bg-[var(--surface-muted)]"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {hint && !error ? (
        <span className="text-xs text-[var(--muted)]">{hint}</span>
      ) : null}
      {error ? (
        <span id={`${inputId}-error`} className="text-xs text-[var(--danger)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { loginSchema } from "@/lib/validations/forms";
import { roleHome } from "@/lib/auth/routes";
import type { UserRole } from "@/types/domain";

export function LoginForm() {
  const router = useRouter();
  const { toast, show } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ phone, password });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        next[String(issue.path[0] ?? "form")] = issue.message;
      });
      setFieldErrors(next);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = await res.json();
      if (!res.ok || !payload.data?.profile) {
        show("error", payload.error?.message ?? "Incorrect phone number or password.");
        return;
      }
      router.replace(roleHome(payload.data.profile.role as UserRole));
      router.refresh();
    } catch {
      show("error", "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Phone number"
          name="phone"
          type="tel"
          inputMode="numeric"
          placeholder="03XXXXXXXXX"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={fieldErrors.phone}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <ToastBanner toast={toast} />
    </>
  );
}

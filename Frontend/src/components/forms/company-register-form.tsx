"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { companyRegisterSchema } from "@/lib/validations/forms";
import { createClient } from "@/lib/supabase/client";
import { sanitizeText } from "@/lib/security/sanitize";

export function CompanyRegisterForm() {
  const router = useRouter();
  const { toast, show } = useToast();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    company_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const parsed = companyRegisterSchema.safeParse({
      ...form,
      company_name: sanitizeText(form.company_name, 120),
      email: sanitizeText(form.email, 160).toLowerCase(),
    });

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
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: {
            company_name: parsed.data.company_name,
            role: "company",
          },
        },
      });

      if (error) {
        show(
          "error",
          error.message.toLowerCase().includes("already")
            ? "This email is already registered."
            : "Unable to create account. Please try again.",
        );
        return;
      }

      if (!data.session) {
        show(
          "info",
          "Check your email to confirm the account, then sign in.",
        );
        router.push("/login");
        return;
      }

      router.replace("/company");
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
          label="Company name"
          name="company_name"
          value={form.company_name}
          onChange={(e) => update("company_name", e.target.value)}
          error={fieldErrors.company_name}
          required
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          error={fieldErrors.email}
          required
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          error={fieldErrors.password}
          hint="Minimum 8 characters"
          required
        />
        <Input
          label="Confirm password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          value={form.confirm_password}
          onChange={(e) => update("confirm_password", e.target.value)}
          error={fieldErrors.confirm_password}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create company account"}
        </Button>
      </form>
      <ToastBanner toast={toast} />
    </>
  );
}

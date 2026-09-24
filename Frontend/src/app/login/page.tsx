import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";
import { LoginForm } from "@/components/forms/login-form";

export const metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-start justify-center bg-[radial-gradient(ellipse_at_top,_rgba(15,92,66,0.12),_transparent_55%),var(--surface)] px-4 pb-[max(2.5rem,var(--kb-inset,0px))] pt-10 sm:items-center sm:py-10">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm md:p-8">
        <BrandMark />
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use your phone number and password.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/" className="font-medium text-[var(--brand)] underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

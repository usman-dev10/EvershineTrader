"use client";

import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { demoLogout } from "@/lib/auth/demo-logout";

export default function AccountPage() {
  const router = useRouter();

  async function onLogout() {
    await demoLogout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="border-b border-[var(--line)] bg-white px-4 py-4 md:px-6">
        <BrandMark />
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">
        <PageHeader
          title="Account"
          description="Signed in with your phone number and password."
        />
        <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
          <p className="text-sm text-[var(--muted)]">
            Use Manage → Create Account to add login accounts, then sign in with
            those phone numbers and passwords.
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

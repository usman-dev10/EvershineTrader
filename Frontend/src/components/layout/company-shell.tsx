"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";

const companyLinks = [
  { href: "/company", label: "Dashboard", exact: true },
  { href: "/company/manage", label: "Manage" },
  { href: "/company/machine-report", label: "Machine Report" },
];

export function CompanyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface)] lg:flex-row">
      <AppSidebar links={companyLinks} />
      <main className="min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}

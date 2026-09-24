"use client";

import Link from "next/link";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Badge } from "@/components/ui/badge";
import type { Shift } from "@/types/domain";

const employeeLinks = [
  { href: "/employee", label: "Dashboard", exact: true },
  { href: "/employee/shifts", label: "Shifts" },
  { href: "/employee/jobs", label: "Jobs" },
  { href: "/employee/sheets", label: "Sheets" },
];

export function EmployeeShell({
  children,
  currentShift,
  shiftReady = true,
}: {
  children: React.ReactNode;
  currentShift: Shift | null;
  shiftReady?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface)] lg:flex-row">
      <AppSidebar
        links={employeeLinks}
        footer={
          !shiftReady ? (
            <Badge tone="neutral" className="w-full justify-center">
              Checking shift…
            </Badge>
          ) : currentShift ? (
            <Badge tone="success" className="w-full justify-center">
              {currentShift.name} · Open
            </Badge>
          ) : (
            <Badge tone="warning" className="w-full justify-center">
              No open shift
            </Badge>
          )
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {!shiftReady ? null : currentShift ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 md:px-6 lg:px-8">
            Working under <strong>{currentShift.name}</strong> · {currentShift.shift_date}{" "}
            <Link
              href={`/employee/shifts/${currentShift.id}`}
              className="ml-2 font-medium underline"
            >
              View shift
            </Link>
          </div>
        ) : (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 md:px-6 lg:px-8">
            No shift is currently open. Open a shift before creating jobs or adding piles.
          </div>
        )}
        <main className="flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

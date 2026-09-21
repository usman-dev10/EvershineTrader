"use client";

import { useEffect, useState } from "react";
import { EmployeeShell } from "@/components/layout/employee-shell";
import { liveApi } from "@/lib/api/live";
import type { Shift } from "@/types/domain";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setCurrentShift(await liveApi<Shift | null>("/shifts/current"));
      } catch {
        setCurrentShift(null);
      }
    })();
  }, []);

  return <EmployeeShell currentShift={currentShift}>{children}</EmployeeShell>;
}

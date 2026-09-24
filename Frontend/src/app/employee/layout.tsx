"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { EmployeeShell } from "@/components/layout/employee-shell";
import { liveApi } from "@/lib/api/live";
import type { Shift } from "@/types/domain";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftReady, setShiftReady] = useState(false);

  const loadCurrent = useCallback(async () => {
    try {
      const shift = await liveApi<Shift | null>("/shifts/current", {
        loader: false,
      });
      setCurrentShift(shift ?? null);
    } catch {
      setCurrentShift(null);
    } finally {
      setShiftReady(true);
    }
  }, []);

  useEffect(() => {
    void loadCurrent();
  }, [loadCurrent, pathname]);

  return (
    <EmployeeShell currentShift={currentShift} shiftReady={shiftReady}>
      {children}
    </EmployeeShell>
  );
}

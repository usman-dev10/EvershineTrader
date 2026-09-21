"use client";

import { useCallback, useEffect, useState } from "react";
import { ShiftsPageClient } from "@/components/employee/shifts-page-client";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import type { Machine, Shift, Supervisor } from "@/types/domain";

export default function EmployeeShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [hasOpenShift, setHasOpenShift] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const errors: string[] = [];

    try {
      const floorSupers = await liveApi<Supervisor[]>("/floor/supervisors");
      setSupervisors(floorSupers);
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "Unable to load supervisors.",
      );
      try {
        const fallback = await liveApi<Supervisor[]>("/supervisors?status=active");
        setSupervisors(fallback);
      } catch {
        setSupervisors([]);
      }
    }

    try {
      const [list, current, machineList] = await Promise.all([
        liveApi<Shift[]>("/shifts"),
        liveApi<Shift | null>("/shifts/current"),
        liveApi<Machine[]>("/machines"),
      ]);
      setShifts(list);
      setHasOpenShift(Boolean(current));
      setMachines(machineList);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Unable to load shifts.");
    }

    setError(errors.length ? errors.join(" ") : null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      {error ? (
        <div className="mb-4">
          <AlertBanner tone="warning">{error}</AlertBanner>
        </div>
      ) : null}
      <ShiftsPageClient
        shifts={shifts}
        supervisors={supervisors}
        machines={machines}
        hasOpenShift={hasOpenShift}
        canCreate
        onCreated={load}
      />
    </>
  );
}

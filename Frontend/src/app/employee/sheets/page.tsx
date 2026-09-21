"use client";

import { useCallback, useEffect, useState } from "react";
import { SheetsWorkClient } from "@/components/employee/sheets-work-client";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import type { Job, Machine, Shift, Supervisor, Worker } from "@/types/domain";

type WorkerAlloc = {
  worker: Worker;
  allocated_sheets: number;
  pile_count: number;
  on_duty: boolean;
};

/** Only remaining > 0 (yellow). Green (0) and red (minus) are excluded. */
function isYellowJob(job: Job): boolean {
  if (job.total_sheets <= 0) return false;
  const remaining =
    typeof job.remaining_sheets === "number"
      ? job.remaining_sheets
      : job.total_sheets - (job.break_sheets ?? job.allocated_sheets ?? 0);
  return remaining > 0;
}

export default function EmployeeSheetsPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workers, setWorkers] = useState<WorkerAlloc[]>([]);
  const [currentShiftId, setCurrentShiftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [jobList, workerList, current, supervisors] = await Promise.all([
        liveApi<Job[]>("/jobs"),
        liveApi<Worker[]>("/workers?status=active"),
        liveApi<Shift | null>("/shifts/current"),
        liveApi<Supervisor[]>("/supervisors?status=active").catch(() => []),
      ]);

      setMachines(current?.machines ?? []);
      setCurrentShiftId(current?.id ?? null);

      const machineIds = new Set((current?.machines ?? []).map((m) => m.id));
      const forSheets = jobList.filter((j) => {
        if (!current) return false;
        const onMachine =
          !j.machine_id || machineIds.size === 0 || machineIds.has(j.machine_id);
        if (!onMachine) return false;
        // Current shift jobs always; prior shifts only if still yellow
        if (j.shift_id === current.id) return true;
        return isYellowJob(j);
      });

      // LIFO: last in first out (newest on top)
      forSheets.sort((a, b) => {
        const tb = new Date(b.created_at ?? 0).getTime();
        const ta = new Date(a.created_at ?? 0).getTime();
        if (tb !== ta) return tb - ta;
        return String(b.id).localeCompare(String(a.id));
      });
      setJobs(forSheets);

      // Hide supervisors from Sheets (shift supervisor + any supervisor names)
      const supervisorNames = new Set(
        supervisors.map((s) => s.name.trim().toLowerCase()),
      );
      if (current?.supervisor_name) {
        supervisorNames.add(current.supervisor_name.trim().toLowerCase());
      }

      let onDutyIds = new Set<string>();
      if (current) {
        const duty = await liveApi<{ worker_id: string; duty_status: string }[]>(
          `/shifts/${current.id}/workers`,
        ).catch(() => []);
        onDutyIds = new Set(
          duty.filter((d) => d.duty_status === "on").map((d) => d.worker_id),
        );
      }

      setWorkers(
        workerList
          .filter((w) => !supervisorNames.has(w.name.trim().toLowerCase()))
          .map((worker) => ({
            worker,
            allocated_sheets: 0,
            pile_count: 0,
            on_duty: onDutyIds.has(worker.id),
          })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sheets.");
    }
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
      <SheetsWorkClient
        machines={machines}
        jobs={jobs}
        workers={workers}
        currentShiftId={currentShiftId}
        onPileCreated={load}
      />
    </>
  );
}

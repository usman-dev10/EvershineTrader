"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShiftDutyClient } from "@/components/employee/shift-duty-client";
import type { JobListItem } from "@/components/employee/jobs-page-client";
import { AlertBanner } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { liveApi } from "@/lib/api/live";
import type { DutyStatus, Machine, Shift, Supervisor, Worker } from "@/types/domain";

type DutyRow = { worker: Worker; duty_status: DutyStatus };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default function EmployeeShiftDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const shiftId = Array.isArray(rawId) ? rawId[0] : rawId;
  const [shift, setShift] = useState<Shift | null>(null);
  const [rows, setRows] = useState<DutyRow[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shiftId) return;
    if (!isUuid(shiftId)) {
      setError("Invalid shift link.");
      return;
    }
    try {
      const found = await liveApi<Shift>(`/shifts/${shiftId}`);
      setShift(found);

      const [workers, duty, machineList, jobList, floorSupers] = await Promise.all([
        liveApi<Worker[]>("/workers?status=active").catch(() => [] as Worker[]),
        liveApi<{ worker_id: string; duty_status: DutyStatus }[]>(
          `/shifts/${shiftId}/workers`,
        ).catch(() => []),
        liveApi<Machine[]>("/machines").catch(() => [] as Machine[]),
        liveApi<JobListItem[]>(`/jobs?shift_id=${shiftId}`).catch(
          () => [] as JobListItem[],
        ),
        liveApi<Supervisor[]>("/floor/supervisors").catch(() => [] as Supervisor[]),
      ]);
      setMachines(machineList);
      setJobs(jobList);
      setSupervisors(floorSupers);
      const dutyMap = new Map(duty.map((d) => [d.worker_id, d.duty_status]));
      setRows(
        workers.map((worker) => ({
          worker,
          duty_status: dutyMap.get(worker.id) ?? "off",
        })),
      );
      setError(null);
    } catch (err) {
      setShift(null);
      setError(err instanceof Error ? err.message : "Unable to load shift.");
    }
  }, [shiftId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="space-y-4">
        <AlertBanner tone="warning">{error}</AlertBanner>
        <Link href="/employee/shifts">
          <Button variant="secondary">Back to shifts</Button>
        </Link>
      </div>
    );
  }

  if (!shift) {
    return <p className="text-sm text-[var(--muted)]">Loading shift…</p>;
  }

  return (
    <ShiftDutyClient
      shift={shift}
      rows={rows}
      allMachines={machines}
      jobs={jobs}
      supervisors={supervisors}
      readOnly={shift.status === "closed"}
      onSaved={load}
      onShiftUpdated={load}
    />
  );
}

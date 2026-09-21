"use client";

import { useCallback, useEffect, useState } from "react";
import { JobsPageClient, type JobListItem } from "@/components/employee/jobs-page-client";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import type { Machine, Shift } from "@/types/domain";

export default function EmployeeJobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [hasOpenShift, setHasOpenShift] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [jobList, current, allMachines] = await Promise.all([
        liveApi<JobListItem[]>("/jobs"),
        liveApi<Shift | null>("/shifts/current"),
        liveApi<Machine[]>("/machines").catch(() => [] as Machine[]),
      ]);
      // LIFO: newest job on top (not grouped by shift A/B)
      setJobs(
        [...jobList].sort((a, b) => {
          const time = (j: JobListItem) => {
            if (j.created_at) {
              const t = new Date(j.created_at).getTime();
              if (!Number.isNaN(t) && t > 0) return t;
            }
            const m = /^J-(\d{14})/.exec(j.job_number ?? "");
            if (m) {
              const s = m[1];
              const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
              const t = new Date(iso).getTime();
              if (!Number.isNaN(t)) return t;
            }
            return 0;
          };
          const diff = time(b) - time(a);
          if (diff !== 0) return diff;
          return String(b.id).localeCompare(String(a.id));
        }),
      );
      setHasOpenShift(Boolean(current));
      // Open-shift machines for create; all machines so edit works after shift close
      const shiftMachines = current?.machines ?? [];
      const byId = new Map<string, Machine>();
      for (const m of [...shiftMachines, ...allMachines]) {
        byId.set(m.id, m);
      }
      setMachines(Array.from(byId.values()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load jobs.");
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
      <JobsPageClient
        jobs={jobs}
        machines={machines}
        hasOpenShift={hasOpenShift}
        canCreate
        basePath="/employee/jobs"
        onCreated={load}
      />
    </>
  );
}

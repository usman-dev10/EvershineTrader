"use client";

import { useState } from "react";
import type { EmployeeDashboard } from "@/types/domain";
import { MetricCard, PageHeader } from "@/components/ui/page";
import { AlertBanner, ToastBanner } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { JobSheetsBarChart } from "@/components/employee/job-sheets-bar-chart";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { liveApi } from "@/lib/api/live";
import { useToast } from "@/hooks/use-toast";

const empty: EmployeeDashboard = {
  current_shift: null,
  workers_on: 0,
  workers_off: 0,
  open_jobs: 0,
  total_machines: 0,
  total_sheets: 0,
  allocated_sheets: 0,
  remaining_sheets: 0,
  previous_yellow_jobs: [],
  workers_pile_in: [],
  job_sheet_bars: [],
};

function formatPileInTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso.slice(11, 16) || "—";
  }
}

export function EmployeeDashboardView({
  data,
  onRefresh,
}: {
  data?: EmployeeDashboard;
  onRefresh?: () => Promise<void> | void;
}) {
  const loaded = Boolean(data);
  const current = data ?? empty;
  const previousYellow = current.previous_yellow_jobs ?? [];
  const workersIn = current.workers_pile_in ?? [];
  const { toast, show } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function pileOut(jobId: string, workerId: string) {
    const key = `${jobId}-${workerId}-out`;
    setBusyKey(key);
    try {
      await liveApi(`/jobs/${jobId}/workers/${workerId}/pile-out`, {
        method: "POST",
        body: JSON.stringify({ pile_out_at: new Date().toISOString() }),
      });
      show("success", "Pile Out recorded.");
      await onRefresh?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to complete pile.");
    } finally {
      setBusyKey(null);
    }
  }

  async function pileCancel(jobId: string, workerId: string, workerName: string) {
    const ok = window.confirm(`Cancel pile IN for ${workerName}? This pile will be removed.`);
    if (!ok) return;
    const key = `${jobId}-${workerId}-cancel`;
    setBusyKey(key);
    try {
      await liveApi(`/jobs/${jobId}/workers/${workerId}/pile-cancel`, {
        method: "POST",
      });
      show("success", "Pile In cancelled.");
      await onRefresh?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to cancel.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Open shift overview, machines on this shift, and prior yellow jobs."
        actions={
          <>
            <Link href="/employee/shifts">
              <Button variant="secondary">Shifts</Button>
            </Link>
            <Link href="/employee/sheets">
              <Button>Record piles</Button>
            </Link>
          </>
        }
      />

      {loaded && !current.current_shift ? (
        <div className="mb-6">
          <AlertBanner tone="warning">
            No shift is currently open. Open a shift before creating jobs or adding piles.
          </AlertBanner>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          label="Current shift"
          value={current.current_shift?.name ?? "—"}
          hint={current.current_shift?.shift_date}
        />
        <MetricCard
          label="Workers on duty"
          value={current.workers_on}
          hint={`${current.workers_off} off`}
        />
        <MetricCard label="Open jobs" value={current.open_jobs} />
        <MetricCard
          label="Machines"
          value={current.total_machines}
          hint="Running on open shift"
        />
      </div>

      <div className="mt-4">
        <MetricCard
          label="Previous yellow jobs"
          value={previousYellow.length}
          hint="Remaining sheets from earlier shifts (green/red not listed)"
        />
      </div>

      {previousYellow.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-950">
            Previous yellow jobs
          </h2>
          <ul className="space-y-2">
            {previousYellow.map((job) => (
              <li
                key={job.id}
                className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="font-medium text-[var(--ink)]">
                    {job.job_name}
                  </span>
                  <span className="text-[var(--muted)]">
                    {" "}
                    · {job.shift_name ?? "Shift"} · {job.shift_date ?? "—"}
                    {job.machine_number || job.machine_name
                      ? ` · ${job.machine_number ?? ""} ${job.machine_name ?? ""}`.trim()
                      : ""}
                  </span>
                </div>
                <Badge tone="warning">
                  Rem {formatNumber(job.remaining_sheets ?? 0)}
                </Badge>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Link href="/employee/sheets">
              <Button size="sm" variant="secondary">
                Continue on Sheets
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Workers with pile IN
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Active pile IN — Out or Cancel here. New pile IN stays on Sheets.
            </p>
          </div>
          <Badge tone={workersIn.length ? "success" : "neutral"}>
            {workersIn.length} active
          </Badge>
        </div>
        {workersIn.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No workers have a pile IN right now.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {workersIn.map((row) => {
              const rowKey = `${row.worker_id}-${row.job_id}`;
              const machine =
                row.machine_number || row.machine_name
                  ? `${row.machine_number ?? ""} · ${row.machine_name ?? ""}`.replace(
                      /^ · | · $/g,
                      "",
                    )
                  : "—";
              return (
                <li
                  key={`${rowKey}-${row.pile_in_at ?? ""}`}
                  className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-[var(--ink)]">
                      {row.worker_name}
                    </p>
                    <Badge tone="success">IN</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div className="col-span-2">
                      <dt className="text-[var(--muted)]">Job name</dt>
                      <dd className="truncate font-medium text-[var(--ink)]">
                        {row.job_name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Job no</dt>
                      <dd className="font-medium text-[var(--ink)]">
                        {row.job_number?.trim() ? row.job_number : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">UPS</dt>
                      <dd className="font-medium text-[var(--ink)]">
                        {row.ups != null ? formatNumber(row.ups) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Break sheets</dt>
                      <dd className="font-medium text-[var(--ink)]">
                        {formatNumber(row.sheets)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Time</dt>
                      <dd className="font-medium text-[var(--ink)]">
                        {formatPileInTime(row.pile_in_at)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[var(--muted)]">Machine</dt>
                      <dd className="truncate font-medium text-[var(--ink)]">
                        {machine}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={busyKey !== null}
                      onClick={() => void pileOut(row.job_id, row.worker_id)}
                    >
                      {busyKey === `${row.job_id}-${row.worker_id}-out`
                        ? "Saving…"
                        : "Out"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyKey !== null}
                      onClick={() =>
                        void pileCancel(row.job_id, row.worker_id, row.worker_name)
                      }
                    >
                      {busyKey === `${row.job_id}-${row.worker_id}-cancel`
                        ? "Cancelling…"
                        : "Cancel"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <JobSheetsBarChart data={current.job_sheet_bars ?? []} />
      <ToastBanner toast={toast} />
    </>
  );
}

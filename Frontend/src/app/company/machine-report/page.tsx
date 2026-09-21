"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DataTable, Td } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/page";
import { AlertBanner } from "@/components/ui/feedback";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { liveApi } from "@/lib/api/live";
import { formatNumber } from "@/lib/utils";
import type { Job, JobPile } from "@/types/domain";

type Machine = { id: string; machine_number: string; name: string };

type ReportJob = {
  id: string;
  job_number: string | null;
  job_name: string;
  total_sheets: number;
  allocated_sheets: number;
  remaining_sheets: number;
  status: string;
  dabbi: boolean;
  ups: number | null;
  shift_name: string | null;
  shift_date: string | null;
  created_at: string | null;
  employees: { name: string; sheets: number; pile_count: number }[];
};

type Report = {
  machine: Machine;
  month: string;
  jobs: ReportJob[];
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function jobDate(job: ReportJob): string {
  if (job.shift_date) return job.shift_date;
  if (job.created_at) return job.created_at.slice(0, 10);
  return "—";
}

function formatClock(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function MachineReportPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailJob, setDetailJob] = useState<ReportJob | null>(null);
  const [detailFull, setDetailFull] = useState<Job | null>(null);
  const [detailPiles, setDetailPiles] = useState<JobPile[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const list = await liveApi<Machine[]>("/machines");
        setMachines(list);
        if (list[0]) setMachineId(list[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load machines.");
      }
    })();
  }, []);

  const loadReport = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await liveApi<Report>(
        `/reports/machines?machine_id=${machineId}&month=${month}`,
      );
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Unable to load report.");
    } finally {
      setLoading(false);
    }
  }, [machineId, month]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const sortedJobs = useMemo(() => {
    const jobs = report?.jobs ?? [];
    return [...jobs].sort((a, b) => {
      const da = jobDate(a);
      const db = jobDate(b);
      if (da !== db) return da.localeCompare(db);
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });
  }, [report]);

  const jobCount = sortedJobs.length;
  const totalSheets = useMemo(
    () => sortedJobs.reduce((sum, j) => sum + (j.total_sheets || 0), 0),
    [sortedJobs],
  );

  async function openDetails(job: ReportJob) {
    setDetailJob(job);
    setDetailFull(null);
    setDetailPiles([]);
    setDetailLoading(true);
    try {
      const [full, piles] = await Promise.all([
        liveApi<Job>(`/jobs/${job.id}`),
        liveApi<JobPile[]>(`/jobs/${job.id}/piles`),
      ]);
      setDetailFull(full);
      setDetailPiles(piles.filter((p) => p.pile_out_at));
    } catch {
      // Fall back to report summary already in detailJob.employees
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Machine Report"
        description="Jobs for the selected machine and month in table form, sorted by date."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Select
          label="Machine"
          name="machine_id"
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          options={machines.map((m) => ({
            value: m.id,
            label: `${m.machine_number} · ${m.name}`,
          }))}
        />
        <Input
          label="Month"
          name="month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {error ? (
        <div className="mb-4">
          <AlertBanner tone="warning">{error}</AlertBanner>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading report…</p>
      ) : !report || jobCount === 0 ? (
        <EmptyState
          title="No jobs this month"
          description="Select a machine to see this month’s jobs."
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">
            {report.machine.machine_number} · {report.machine.name} ·{" "}
            {report.month} · {jobCount} jobs · {formatNumber(totalSheets)} total
            sheets
          </p>

          <DataTable
            headers={[
              "Date",
              "Job No",
              "Job Name",
              "UPS",
              "Total Sheets",
              "Dabbi",
              "Shift",
              "",
            ]}
          >
            {sortedJobs.map((job) => (
              <tr key={job.id}>
                <Td>{jobDate(job)}</Td>
                <Td className="font-medium">
                  {job.job_number?.trim() ? job.job_number : "—"}
                </Td>
                <Td>{job.job_name}</Td>
                <Td>{job.ups != null ? formatNumber(job.ups) : "—"}</Td>
                <Td>
                  {job.total_sheets > 0
                    ? formatNumber(job.total_sheets)
                    : "Unlimited"}
                </Td>
                <Td>
                  <Badge tone={job.dabbi ? "warning" : "neutral"}>
                    {job.dabbi ? "Yes" : "No"}
                  </Badge>
                </Td>
                <Td>{job.shift_name ?? "—"}</Td>
                <Td>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void openDetails(job)}
                  >
                    Details
                  </Button>
                </Td>
              </tr>
            ))}
          </DataTable>
        </>
      )}

      <Modal
        open={Boolean(detailJob)}
        title={detailJob ? `Job · ${detailJob.job_name}` : "Job detail"}
        onClose={() => {
          setDetailJob(null);
          setDetailFull(null);
          setDetailPiles([]);
        }}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setDetailJob(null);
              setDetailFull(null);
              setDetailPiles([]);
            }}
          >
            Close
          </Button>
        }
      >
        {detailJob ? (
          <div className="space-y-4">
            {detailLoading ? (
              <p className="text-sm text-[var(--muted)]">Loading detail…</p>
            ) : null}

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Date</dt>
                <dd className="font-medium">{jobDate(detailJob)}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Job No</dt>
                <dd className="font-medium">
                  {detailJob.job_number?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Job Name</dt>
                <dd className="font-medium">{detailJob.job_name}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Shift</dt>
                <dd className="font-medium">{detailJob.shift_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">UPS</dt>
                <dd className="font-medium">
                  {detailJob.ups != null ? formatNumber(detailJob.ups) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Dabbi</dt>
                <dd className="font-medium">{detailJob.dabbi ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Total sheets</dt>
                <dd className="font-medium">
                  {detailJob.total_sheets > 0
                    ? formatNumber(detailJob.total_sheets)
                    : "Unlimited"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Break sheet</dt>
                <dd className="font-medium">
                  {formatNumber(
                    detailFull?.break_sheets ?? detailJob.allocated_sheets,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Remaining</dt>
                <dd className="font-medium">
                  {detailJob.total_sheets > 0
                    ? formatNumber(
                        detailFull?.remaining_sheets ??
                          detailJob.remaining_sheets,
                      )
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Status</dt>
                <dd>
                  <Badge tone={statusTone(detailFull?.status ?? detailJob.status)}>
                    {detailFull?.status ?? detailJob.status}
                  </Badge>
                </dd>
              </div>
              {detailFull?.machine_number || detailFull?.machine_name ? (
                <div className="sm:col-span-2">
                  <dt className="text-[var(--muted)]">Machine</dt>
                  <dd className="font-medium">
                    {`${detailFull.machine_number ?? ""} · ${detailFull.machine_name ?? ""}`.replace(
                      /^ · | · $/g,
                      "",
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-[var(--ink)]">
                Workers
              </h3>
              {detailPiles.length > 0 ? (
                <DataTable
                  headers={[
                    "Worker",
                    "Series",
                    "Sheets",
                    "Date",
                    "Time in",
                    "Time out",
                    "Shift",
                  ]}
                >
                  {detailPiles.map((pile) => (
                    <tr key={pile.id}>
                      <Td className="font-medium">
                        {pile.worker_name ?? "—"}
                      </Td>
                      <Td>{pile.series_no ?? "—"}</Td>
                      <Td>{formatNumber(pile.sheets)}</Td>
                      <Td>{pile.pile_date ?? pile.work_shift_date ?? "—"}</Td>
                      <Td>{formatClock(pile.pile_in_at)}</Td>
                      <Td>{formatClock(pile.pile_out_at)}</Td>
                      <Td>
                        {pile.work_shift_name ?? "—"}
                        {pile.other_shift ? (
                          <span className="ml-1 text-xs text-amber-800">
                            (other)
                          </span>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </DataTable>
              ) : detailJob.employees.length > 0 ? (
                <DataTable headers={["Worker", "Sheets", "Piles"]}>
                  {detailJob.employees.map((emp, idx) => (
                    <tr key={`${detailJob.id}-${idx}`}>
                      <Td className="font-medium">{emp.name}</Td>
                      <Td>{formatNumber(emp.sheets)}</Td>
                      <Td>{emp.pile_count}</Td>
                    </tr>
                  ))}
                </DataTable>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  No worker piles recorded yet.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

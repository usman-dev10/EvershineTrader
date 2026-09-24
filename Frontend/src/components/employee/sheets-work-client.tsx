"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { EmptyState, MetricCard, PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ToastBanner, AlertBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { liveApi } from "@/lib/api/live";
import { formatNumber } from "@/lib/utils";
import type { Job, Machine, Worker } from "@/types/domain";

type WorkerAlloc = {
  worker: Worker;
  allocated_sheets: number;
  pile_count: number;
  on_duty: boolean;
};

type WorkerStat = {
  worker_id: string;
  worker_name: string;
  on_duty: boolean;
  break_sheets: number;
  pile_count: number;
  open_pile_count: number;
  open_pile_id: string | null;
  open_pile_sheets: number | null;
  open_pile_in_at: string | null;
  open_on_other_job?: string | null;
};

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

/** Local HH:mm for <input type="time"> — current clock. */
function nowTimeLocal(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Build ISO timestamp for today at the given local HH:mm. */
function localTimeToIso(time: string): string {
  const [hh, mm] = time.split(":").map((p) => Number(p));
  const d = new Date();
  d.setHours(
    Number.isFinite(hh) ? hh : d.getHours(),
    Number.isFinite(mm) ? mm : d.getMinutes(),
    0,
    0,
  );
  return d.toISOString();
}

function jobLabel(j: Job, currentShiftId?: string | null): string {
  const shift = j.shift_name ?? "Shift";
  const date = j.shift_date ?? "—";
  const remaining =
    j.total_sheets > 0
      ? typeof j.remaining_sheets === "number"
        ? j.remaining_sheets
        : j.total_sheets - (j.break_sheets ?? j.allocated_sheets ?? 0)
      : null;
  const prior =
    currentShiftId && j.shift_id !== currentShiftId ? " · prior yellow" : "";
  const rem =
    remaining != null && remaining > 0
      ? ` · rem ${formatNumber(remaining)}`
      : "";
  return `${j.job_name} · ${shift} · ${date}${rem}${prior}`;
}

export function SheetsWorkClient({
  machines,
  jobs,
  workers,
  selectedMachineId,
  selectedJob,
  currentShiftId,
  readOnly,
  onPileCreated,
}: {
  machines: Machine[];
  jobs: Job[];
  workers: WorkerAlloc[];
  selectedMachineId?: string;
  selectedJob?: Job | null;
  currentShiftId?: string | null;
  readOnly?: boolean;
  onPileCreated?: () => Promise<void> | void;
}) {
  const { toast, show } = useToast();
  const [machineId, setMachineId] = useState(
    selectedMachineId ?? machines[0]?.id ?? "",
  );
  const [jobId, setJobId] = useState(selectedJob?.id ?? "");
  const [job, setJob] = useState<Job | null>(selectedJob ?? null);
  const [stats, setStats] = useState<WorkerStat[]>([]);
  const [pileOpen, setPileOpen] = useState(false);
  const [outOpen, setOutOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [sheetChoice, setSheetChoice] = useState(""); // "2500" | "2000" | "custom"
  const [customSheets, setCustomSheets] = useState("");
  const [inTime, setInTime] = useState(nowTimeLocal);
  const [outTime, setOutTime] = useState(nowTimeLocal);
  const [lastTimes, setLastTimes] = useState<{
    inAt: string;
    outAt?: string | null;
  } | null>(null);

  useEffect(() => {
    if (selectedMachineId) {
      setMachineId(selectedMachineId);
      return;
    }
    if (machines.length === 0) {
      setMachineId("");
      return;
    }
    setMachineId((current) => {
      if (current && machines.some((m) => m.id === current)) return current;
      return machines[0].id;
    });
  }, [machines, selectedMachineId]);

  useEffect(() => {
    if (!machineId) return;
    setJobId((current) => {
      if (!current) return current;
      const stillValid = jobs.some(
        (j) =>
          j.id === current && (!j.machine_id || j.machine_id === machineId),
      );
      return stillValid ? current : "";
    });
  }, [machineId, jobs]);

  const machineJobs = useMemo(() => {
    const list = !machineId
      ? jobs
      : jobs.filter((j) => !j.machine_id || j.machine_id === machineId);
    // LIFO: newest job on top
    return [...list].sort((a, b) => {
      const time = (j: typeof list[number]) => {
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
    });
  }, [jobs, machineId]);

  const loadJobData = useCallback(async (id: string) => {
    const [jobData, workerStats] = await Promise.all([
      liveApi<Job>(`/jobs/${id}`),
      liveApi<WorkerStat[]>(`/jobs/${id}/worker-stats`),
    ]);
    setJob(jobData);
    setStats(workerStats);
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setStats([]);
      return;
    }
    void loadJobData(jobId).catch((err) => {
      show(
        "error",
        err instanceof Error ? err.message : "Unable to load job.",
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, loadJobData]);

  const dutyRows = useMemo(() => {
    const byId = new Map(stats.map((s) => [s.worker_id, s]));
    return workers
      .filter((w) => w.on_duty)
      .map(({ worker }) => {
        const s = byId.get(worker.id);
        return {
          worker,
          break_sheets: s?.break_sheets ?? 0,
          pile_count: s?.pile_count ?? 0,
          open_pile_count: s?.open_pile_count ?? 0,
          open_pile_in_at: s?.open_pile_in_at ?? null,
          open_on_other_job: s?.open_on_other_job ?? null,
        };
      });
  }, [workers, stats]);

  const isPriorYellow =
    Boolean(job && currentShiftId && job.shift_id !== currentShiftId);

  function openIn(worker: Worker) {
    if (readOnly) return;
    const other = dutyRows.find((r) => r.worker.id === worker.id)
      ?.open_on_other_job;
    if (other) {
      show(
        "error",
        `This worker already has a pile IN on ${other}. Press Out on that job first.`,
      );
      return;
    }
    setActiveWorker(worker);
    setSheetChoice("");
    setCustomSheets("");
    setInTime(nowTimeLocal());
    setPileOpen(true);
  }

  function openOut(worker: Worker) {
    if (readOnly) return;
    setActiveWorker(worker);
    setOutTime(nowTimeLocal());
    setOutOpen(true);
  }

  async function saveIn() {
    if (!job || !activeWorker) return;

    let sheets = 0;
    if (sheetChoice === "2500" || sheetChoice === "2000") {
      sheets = Number(sheetChoice);
    } else if (sheetChoice === "custom") {
      sheets = Number(customSheets);
    } else {
      show("error", "Select 2500, 2000, or Custom.");
      return;
    }

    if (!Number.isInteger(sheets) || sheets <= 0) {
      show("error", "Please enter a valid number of sheets.");
      return;
    }

    if (!inTime) {
      show("error", "Select In time.");
      return;
    }

    const pileInAt = localTimeToIso(inTime);
    setPending(true);
    try {
      const result = await liveApi<{
        pile: { pile_in_at?: string | null; pile_out_at?: string | null };
      }>(`/jobs/${job.id}/workers/${activeWorker.id}/piles`, {
        method: "POST",
        body: JSON.stringify({
          sheets,
          is_custom: true,
          sheet_option_id: null,
          open_only: true,
          pile_in_at: pileInAt,
        }),
      });
      setLastTimes({
        inAt: result.pile.pile_in_at ?? pileInAt,
        outAt: null,
      });
      show("success", "Pile In recorded. Break sheet updates after Out.");
      setPileOpen(false);
      await loadJobData(job.id);
      await onPileCreated?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to start pile.");
    } finally {
      setPending(false);
    }
  }

  async function saveOut() {
    if (!job || !activeWorker) return;
    if (!outTime) {
      show("error", "Select Out time.");
      return;
    }
    const pileOutAt = localTimeToIso(outTime);
    setPending(true);
    try {
      const result = await liveApi<{
        pile: { pile_in_at?: string | null; pile_out_at?: string | null };
      }>(`/jobs/${job.id}/workers/${activeWorker.id}/pile-out`, {
        method: "POST",
        body: JSON.stringify({ pile_out_at: pileOutAt }),
      });
      setLastTimes({
        inAt: result.pile.pile_in_at ?? "",
        outAt: result.pile.pile_out_at ?? pileOutAt,
      });
      show("success", "Pile Out recorded. Break sheet updated.");
      setOutOpen(false);
      await loadJobData(job.id);
      await onPileCreated?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to complete pile.");
    } finally {
      setPending(false);
    }
  }

  async function doCancel(worker: Worker) {
    if (!job || readOnly) return;
    setPending(true);
    try {
      await liveApi(`/jobs/${job.id}/workers/${worker.id}/pile-cancel`, {
        method: "POST",
      });
      setLastTimes(null);
      show("success", "Pile In cancelled.");
      await loadJobData(job.id);
      await onPileCreated?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to cancel.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sheets"
        description="In / Out / Cancel. Prior yellow jobs (remaining sheets) stay available after a new shift opens."
      />

      {readOnly ? (
        <div className="mb-4">
          <AlertBanner tone="info">
            Company oversight view — pile entry is available on the employee floor screens.
          </AlertBanner>
        </div>
      ) : null}

      {machines.length === 0 ? (
        <div className="mb-4">
          <AlertBanner tone="warning">
            No machines are selected for the open shift. Edit the shift and tick machine numbers.
          </AlertBanner>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Select
          label="Machine"
          name="machine_id"
          value={machineId}
          onChange={(e) => {
            setMachineId(e.target.value);
            setJobId("");
          }}
          options={machines.map((m) => ({
            value: m.id,
            label: `${m.machine_number ?? ""} · ${m.name}`.replace(/^ · /, ""),
          }))}
          placeholder="Shift machines only…"
        />
        <Select
          label="Job (name · shift · date)"
          name="job_id"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          options={machineJobs.map((j) => ({
            value: j.id,
            label: jobLabel(j, currentShiftId),
          }))}
          placeholder={machineId ? "Select job…" : "Select a machine first"}
        />
      </div>

      {lastTimes ? (
        <p className="mb-4 text-sm text-[var(--muted)]">
          Last · In {formatClock(lastTimes.inAt)}
          {lastTimes.outAt
            ? ` · Out ${formatClock(lastTimes.outAt)}`
            : " · waiting for Out or Cancel"}
        </p>
      ) : null}

      {!job ? (
        <EmptyState
          title="Select a job"
          description="Choose a machine, then a job (includes prior yellow jobs with remaining sheets)."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">{job.job_name}</span>
            <span>·</span>
            <span>
              {job.shift_name ?? "Shift"} · {job.shift_date ?? "—"}
            </span>
            {isPriorYellow ? (
              <Badge tone="warning">Prior yellow · remaining sheets</Badge>
            ) : null}
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Total sheets"
              value={
                job.total_sheets > 0
                  ? formatNumber(job.total_sheets)
                  : "Unlimited"
              }
            />
            <MetricCard
              label="Break sheet"
              value={formatNumber(job.break_sheets ?? job.allocated_sheets ?? 0)}
            />
            <MetricCard
              label="Remaining"
              value={
                job.total_sheets > 0
                  ? formatNumber(job.remaining_sheets ?? job.total_sheets)
                  : "—"
              }
            />
          </div>

          <DataTable headers={["Worker", "Break sheet", "Piles", ""]}>
            {dutyRows.map(
              ({
                worker,
                break_sheets,
                pile_count,
                open_pile_count,
                open_pile_in_at,
                open_on_other_job,
              }) => (
                <tr key={worker.id}>
                  <Td className="font-medium">
                    {worker.name}
                    {open_pile_count > 0 ? (
                      <div className="text-xs text-[var(--muted)]">
                        In since {formatClock(open_pile_in_at)}
                      </div>
                    ) : null}
                    {open_on_other_job ? (
                      <div className="text-xs text-[var(--danger)]">
                        IN on {open_on_other_job} — Out first
                      </div>
                    ) : null}
                  </Td>
                  <Td>{formatNumber(break_sheets)}</Td>
                  <Td>
                    {formatNumber(pile_count)}
                    {open_pile_count > 0 ? (
                      <span className="ml-1 text-xs text-[var(--muted)]">
                        (+{open_pile_count} open)
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {!readOnly ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[var(--muted)]">
                          Add pile
                        </span>
                        <Button
                          size="sm"
                          onClick={() => openIn(worker)}
                          disabled={
                            pending ||
                            open_pile_count > 0 ||
                            Boolean(open_on_other_job)
                          }
                        >
                          In
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openOut(worker)}
                          disabled={pending || open_pile_count === 0}
                        >
                          Out
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void doCancel(worker)}
                          disabled={pending || open_pile_count === 0}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Badge tone="neutral">View only</Badge>
                    )}
                  </Td>
                </tr>
              ),
            )}
          </DataTable>
        </>
      )}

      <Modal
        open={pileOpen}
        title={`Pile In · ${activeWorker?.name ?? ""}`}
        onClose={() => setPileOpen(false)}
        onSubmit={() => void saveIn()}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPileOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "In"}
            </Button>
          </>
        }
      >
        <Select
          label="Sheets"
          name="sheet_choice"
          value={sheetChoice}
          onChange={(e) => {
            setSheetChoice(e.target.value);
            if (e.target.value !== "custom") setCustomSheets("");
          }}
          options={[
            { value: "2500", label: "2500" },
            { value: "2000", label: "2000" },
            { value: "custom", label: "Custom" },
          ]}
          placeholder="Select sheets…"
        />
        {sheetChoice === "custom" ? (
          <Input
            label="Custom sheets"
            name="sheets"
            type="number"
            min={1}
            value={customSheets}
            onChange={(e) => setCustomSheets(e.target.value)}
          />
        ) : null}
        <Input
          label="In time"
          name="in_time"
          type="time"
          value={inTime}
          onChange={(e) => setInTime(e.target.value)}
          hint="Defaults to current time — change if needed"
        />
      </Modal>

      <Modal
        open={outOpen}
        title={`Pile Out · ${activeWorker?.name ?? ""}`}
        onClose={() => setOutOpen(false)}
        onSubmit={() => void saveOut()}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOutOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Out"}
            </Button>
          </>
        }
      >
        <Input
          label="Out time"
          name="out_time"
          type="time"
          value={outTime}
          onChange={(e) => setOutTime(e.target.value)}
          hint="Defaults to current time — change if needed"
        />
      </Modal>
      <ToastBanner toast={toast} />
    </>
  );
}

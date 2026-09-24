"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ToastBanner, AlertBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { liveApi } from "@/lib/api/live";
import { cn, formatNumber } from "@/lib/utils";
import type { Job, Machine, Shift } from "@/types/domain";

export type JobListItem = Job & {
  shift_name?: string | null;
  shift_date?: string | null;
  machine_number?: string | null;
  machine_name?: string | null;
};

type JobForm = {
  job_name: string;
  machine_id: string;
  job_number: string;
  total_sheets: string;
  ups: string;
  dabbi: "" | "yes" | "no";
};

const emptyForm = (): JobForm => ({
  job_name: "",
  machine_id: "",
  job_number: "",
  total_sheets: "",
  ups: "",
  dabbi: "",
});

/** Remaining: minus=red, zero=green, plus=yellow (also prior-shift leftover work). */
function remainingTone(
  remaining: number | null | undefined,
): "danger" | "success" | "warning" | "neutral" {
  if (remaining == null) return "neutral";
  if (remaining < 0) return "danger";
  if (remaining === 0) return "success";
  return "warning";
}

function jobRemaining(job: JobListItem): number | null {
  if (job.total_sheets <= 0) return null;
  if (typeof job.remaining_sheets === "number") return job.remaining_sheets;
  const broken = job.break_sheets ?? job.allocated_sheets ?? 0;
  return job.total_sheets - broken;
}

function rowTint(remaining: number | null): string {
  if (remaining == null) return "";
  if (remaining < 0) return "bg-rose-50/80";
  if (remaining === 0) return "bg-emerald-50/70";
  return "bg-amber-50/80";
}

/** LIFO: newest job on top (by created_at, else J-timestamp in job_number). */
function jobSortTime(job: JobListItem): number {
  if (job.created_at) {
    const t = new Date(job.created_at).getTime();
    if (!Number.isNaN(t) && t > 0) return t;
  }
  const m = /^J-(\d{14})/.exec(job.job_number ?? "");
  if (m) {
    const s = m[1];
    const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function shiftLetterRank(name: string | null | undefined): number {
  return (name ?? "").trim().toUpperCase() === "B" ? 1 : 0;
}

function laterShiftsForJob(job: JobListItem, shifts: Shift[]): Shift[] {
  const jobDate = job.shift_date ?? "";
  const jobLetter = job.shift_name ?? "";
  return [...shifts]
    .filter((s) => {
      if (s.id === job.shift_id) return false;
      if (!jobDate) return s.id !== job.shift_id;
      if (s.shift_date > jobDate) return true;
      if (s.shift_date < jobDate) return false;
      return shiftLetterRank(s.name) > shiftLetterRank(jobLetter);
    })
    .sort((a, b) => {
      if (a.shift_date !== b.shift_date) {
        return a.shift_date.localeCompare(b.shift_date);
      }
      return shiftLetterRank(a.name) - shiftLetterRank(b.name);
    });
}

function sortJobsLifo(jobs: JobListItem[]): JobListItem[] {
  return [...jobs].sort((a, b) => {
    const diff = jobSortTime(b) - jobSortTime(a);
    if (diff !== 0) return diff;
    return String(b.id).localeCompare(String(a.id));
  });
}

export function JobsPageClient({
  jobs,
  machines,
  hasOpenShift,
  canCreate,
  basePath,
  targetShiftId,
  embedded,
  onCreated,
}: {
  jobs: JobListItem[];
  machines: Machine[];
  hasOpenShift: boolean;
  canCreate: boolean;
  basePath: "/employee/jobs" | "/company/jobs";
  targetShiftId?: string | null;
  embedded?: boolean;
  onCreated?: () => Promise<void> | void;
}) {
  const { toast, show } = useToast();
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<JobListItem | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm());
  const [sameJob, setSameJob] = useState<JobListItem | null>(null);
  const [menuJob, setMenuJob] = useState<JobListItem | null>(null);
  const [laterShifts, setLaterShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const orderedJobs = useMemo(() => sortJobsLifo(jobs), [jobs]);

  function onNew() {
    if (!targetShiftId && !hasOpenShift) {
      show("error", "No shift is currently open. Please open a shift before creating a job.");
      return;
    }
    setEditJob(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function onEdit(job: JobListItem) {
    setEditJob(job);
    setForm({
      job_name: job.job_name,
      machine_id: job.machine_id ?? "",
      job_number: job.job_number ?? "",
      total_sheets:
        job.total_sheets > 0 ? String(job.total_sheets) : "",
      ups: job.ups != null ? String(job.ups) : "",
      dabbi: job.dabbi ? "yes" : "no",
    });
    setOpen(true);
  }

  async function onSame(job: JobListItem) {
    setPending(true);
    try {
      const list = await liveApi<Shift[]>("/shifts");
      const later = laterShiftsForJob(job, list);
      if (later.length === 0) {
        show("error", "No later shifts after this job.");
        return;
      }
      setSameJob(job);
      setLaterShifts(later);
      setSelectedShiftId(later[0]?.id ?? "");
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to load shifts.");
    } finally {
      setPending(false);
    }
  }

  async function confirmSame() {
    if (!sameJob || !selectedShiftId) {
      show("error", "Select a shift.");
      return;
    }
    setPending(true);
    try {
      await liveApi(`/jobs/${sameJob.id}/duplicate`, {
        method: "POST",
        body: JSON.stringify({ shift_id: selectedShiftId }),
      });
      show("success", "Job copied to the selected shift with unlimited total sheets.");
      setSameJob(null);
      setLaterShifts([]);
      setSelectedShiftId("");
      await onCreated?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to copy job.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(job: JobListItem) {
    const label = job.job_number?.trim() || job.job_name;
    const ok = window.confirm(
      `Delete ${label}?\n\nThis permanently removes this job and all worker piles for it. This cannot be undone.`,
    );
    if (!ok) return;
    setDeletingId(job.id);
    try {
      await liveApi(`/jobs/${job.id}`, { method: "DELETE" });
      show("success", "Job deleted.");
      await onCreated?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to delete job.");
    } finally {
      setDeletingId(null);
    }
  }

  async function submitJob() {
    if (!form.job_name.trim()) {
      show("error", "Job name is required.");
      return;
    }
    if (!form.machine_id) {
      show("error", "Machine number is required.");
      return;
    }
    const upsRaw = form.ups.trim();
    const ups = Number(upsRaw);
    if (!upsRaw || !Number.isInteger(ups) || ups < 0) {
      show("error", "UPS is required (whole number).");
      return;
    }
    if (form.dabbi !== "yes" && form.dabbi !== "no") {
      show("error", "Dabbi is required — select Yes or No.");
      return;
    }
    const body = {
      job_name: form.job_name.trim(),
      machine_id: form.machine_id,
      job_number: form.job_number.trim() || null,
      total_sheets:
        form.total_sheets.trim() === "" ? null : Number(form.total_sheets),
      ups,
      dabbi: form.dabbi === "yes",
      ...(targetShiftId && !editJob ? { shift_id: targetShiftId } : {}),
    };
    setPending(true);
    try {
      if (editJob) {
        await liveApi(`/jobs/${editJob.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        show("success", "Job updated.");
      } else {
        await liveApi("/jobs", {
          method: "POST",
          body: JSON.stringify(body),
        });
        show("success", "Job saved.");
      }
      setOpen(false);
      setEditJob(null);
      setForm(emptyForm());
      await onCreated?.();
    } catch (err) {
      show(
        "error",
        err instanceof Error
          ? err.message
          : editJob
            ? "Unable to update job."
            : "Unable to create job.",
      );
    } finally {
      setPending(false);
    }
  }

  const canAdd = canCreate && Boolean(targetShiftId || hasOpenShift);

  return (
    <>
      {embedded ? (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
              Jobs
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Jobs added here belong to this shift.
            </p>
          </div>
          {canCreate ? <Button onClick={onNew}>New job</Button> : null}
        </div>
      ) : (
        <PageHeader
          title="Jobs"
          description="LIFO: newest job on top. Remaining — yellow still open, green done, red over."
          actions={
            canCreate ? (
              <Button onClick={onNew} disabled={!hasOpenShift}>
                New job
              </Button>
            ) : undefined
          }
        />
      )}

      {!embedded && !hasOpenShift && canCreate ? (
        <div className="mb-4">
          <AlertBanner tone="warning">
            New job is disabled until a shift is open.
          </AlertBanner>
        </div>
      ) : null}

      {orderedJobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Save a job with a name, then add piles from Sheets."
          action={
            canCreate && canAdd ? (
              <Button onClick={onNew}>New job</Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          headers={[
            "Job name",
            "Job no",
            "Date / shift",
            "UPS",
            "Total sheets",
            "Break sheets",
            "Remaining sheets",
            "",
          ]}
        >
          {orderedJobs.map((job) => {
            const remaining = jobRemaining(job);
            const shiftLabel = job.shift_name
              ? `Shift-${job.shift_name}`
              : null;
            return (
              <tr key={job.id} className={cn(rowTint(remaining))}>
                <Td className="font-medium">{job.job_name}</Td>
                <Td>{job.job_number?.trim() ? job.job_number : "—"}</Td>
                <Td>
                  {job.shift_date ?? "—"}
                  {shiftLabel ? (
                    <div className="text-xs text-[var(--muted)]">{shiftLabel}</div>
                  ) : null}
                </Td>
                <Td>{job.ups != null ? formatNumber(job.ups) : "—"}</Td>
                <Td>
                  {job.total_sheets > 0
                    ? formatNumber(job.total_sheets)
                    : "Unlimited"}
                </Td>
                <Td>
                  {formatNumber(job.break_sheets ?? job.allocated_sheets ?? 0)}
                </Td>
                <Td>
                  <Badge tone={remainingTone(remaining)}>
                    {remaining == null ? "Unlimited" : formatNumber(remaining)}
                  </Badge>
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setMenuJob(job)}
                  >
                    Detail
                  </Button>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal
        open={Boolean(menuJob)}
        title={menuJob?.job_name ?? "Job"}
        onClose={() => setMenuJob(null)}
        footer={
          <Button variant="secondary" onClick={() => setMenuJob(null)}>
            Close
          </Button>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          {menuJob?.job_number?.trim() ? menuJob.job_number : "—"}
          {menuJob?.shift_date
            ? ` · ${menuJob.shift_date}${menuJob.shift_name ? ` Shift-${menuJob.shift_name}` : ""}`
            : ""}
        </p>
        <div className="flex flex-col gap-2">
          {canCreate ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                const job = menuJob;
                setMenuJob(null);
                if (job) onEdit(job);
              }}
            >
              Edit
            </Button>
          ) : null}
          {menuJob ? (
            <Link href={`${basePath}/${menuJob.id}/workers`} className="w-full">
              <Button className="w-full" variant="secondary">
                Worker
              </Button>
            </Link>
          ) : null}
          {canCreate ? (
            <Button
              className="w-full"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                const job = menuJob;
                setMenuJob(null);
                if (job) void onSame(job);
              }}
            >
              Same
            </Button>
          ) : null}
          {canCreate ? (
            <Button
              className="w-full"
              variant="danger"
              disabled={Boolean(menuJob && deletingId === menuJob.id)}
              onClick={() => {
                const job = menuJob;
                setMenuJob(null);
                if (job) void onDelete(job);
              }}
            >
              {menuJob && deletingId === menuJob.id ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={open}
        title={editJob ? "Edit job" : "Add job"}
        onClose={() => {
          setOpen(false);
          setEditJob(null);
        }}
        onSubmit={submitJob}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setEditJob(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editJob ? "Save changes" : "Save job"}
            </Button>
          </>
        }
      >
        <Input
          label="Job name"
          name="job_name"
          required
          value={form.job_name}
          onChange={(e) => setForm({ ...form, job_name: e.target.value })}
          hint="Required"
        />
        <Select
          label="Machine number"
          name="machine_id"
          required
          value={form.machine_id}
          onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
          options={machines.map((m) => ({
            value: m.id,
            label: `${m.machine_number ?? ""} · ${m.name}`.replace(/^ · /, ""),
          }))}
          placeholder="Select machine…"
        />
        <Input
          label="Job number (optional)"
          name="job_number"
          value={form.job_number}
          onChange={(e) => setForm({ ...form, job_number: e.target.value })}
          hint="Must be unique on this shift. Same number is allowed on another shift. Leave blank for Job1, Job2…"
        />
        <Input
          label="Total sheets (optional)"
          name="total_sheets"
          type="number"
          min={0}
          value={form.total_sheets}
          onChange={(e) => setForm({ ...form, total_sheets: e.target.value })}
          hint="Leave blank for unlimited"
        />
        <Input
          label="UPS"
          name="ups"
          type="number"
          min={0}
          step={1}
          required
          value={form.ups}
          onChange={(e) => setForm({ ...form, ups: e.target.value })}
          hint="Required"
        />
        <Select
          label="Dabbi"
          name="dabbi"
          required
          value={form.dabbi}
          onChange={(e) =>
            setForm({
              ...form,
              dabbi: e.target.value as "" | "yes" | "no",
            })
          }
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          placeholder="Select Yes or No…"
        />
      </Modal>
      <Modal
        open={Boolean(sameJob)}
        title={`Same job · ${sameJob?.job_name ?? ""}`}
        onClose={() => {
          setSameJob(null);
          setLaterShifts([]);
          setSelectedShiftId("");
        }}
        onSubmit={confirmSame}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setSameJob(null);
                setLaterShifts([]);
                setSelectedShiftId("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !selectedShiftId}>
              {pending ? "Copying…" : "Copy to shift"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          Shifts after {sameJob?.shift_date ?? "this job"}{" "}
          {sameJob?.shift_name ? `Shift-${sameJob.shift_name}` : ""}. Copy uses
          unlimited total sheets.
        </p>
        <div className="space-y-2 rounded-lg border border-[var(--line)] p-3">
          {laterShifts.map((shift) => (
            <label key={shift.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="same-shift"
                checked={selectedShiftId === shift.id}
                onChange={() => setSelectedShiftId(shift.id)}
              />
              {shift.shift_date} · Shift-{shift.name}
              {shift.status === "open" ? " · open" : ""}
            </label>
          ))}
        </div>
      </Modal>
      <ToastBanner toast={toast} />
    </>
  );
}

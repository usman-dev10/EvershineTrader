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
import type { Job, Machine } from "@/types/domain";

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
  onCreated,
}: {
  jobs: JobListItem[];
  machines: Machine[];
  hasOpenShift: boolean;
  canCreate: boolean;
  basePath: "/employee/jobs" | "/company/jobs";
  onCreated?: () => Promise<void> | void;
}) {
  const { toast, show } = useToast();
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<JobListItem | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<JobForm>(emptyForm());
  const orderedJobs = useMemo(() => sortJobsLifo(jobs), [jobs]);

  function onNew() {
    if (!hasOpenShift) {
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

  return (
    <>
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

      {!hasOpenShift && canCreate ? (
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
            canCreate && hasOpenShift ? (
              <Button onClick={onNew}>New job</Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          headers={["Job name", "Shift", "Date", "Machine", "Remaining sheets", ""]}
        >
          {orderedJobs.map((job) => {
            const remaining = jobRemaining(job);
            return (
              <tr key={job.id} className={cn(rowTint(remaining))}>
                <Td className="font-medium">
                  {job.job_name}
                  <div className="text-xs text-[var(--muted)]">
                  {job.job_number?.trim() ? job.job_number : "—"}
                </div>
                </Td>
                <Td>{job.shift_name ?? "—"}</Td>
                <Td>{job.shift_date ?? "—"}</Td>
                <Td>
                  {job.machine_number || job.machine_name
                    ? `${job.machine_number ?? ""} · ${job.machine_name ?? ""}`.replace(
                        /^ · | · $/g,
                        "",
                      )
                    : "—"}
                </Td>
                <Td>
                  <Badge tone={remainingTone(remaining)}>
                    {remaining == null ? "Unlimited" : formatNumber(remaining)}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    {canCreate ? (
                      <Button size="sm" variant="secondary" onClick={() => onEdit(job)}>
                        Edit
                      </Button>
                    ) : null}
                    <Link href={`${basePath}/${job.id}`}>
                      <Button size="sm" variant="secondary">
                        View
                      </Button>
                    </Link>
                    <Link href={`${basePath}/${job.id}/workers`}>
                      <Button size="sm" variant="secondary">
                        Worker
                      </Button>
                    </Link>
                  </div>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Modal
        open={open}
        title={editJob ? "Edit job" : "Add job"}
        onClose={() => {
          setOpen(false);
          setEditJob(null);
        }}
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
            <Button onClick={submitJob} disabled={pending}>
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
          hint="Optional — leave blank for Job1, Job2, Job3…"
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
      <ToastBanner toast={toast} />
    </>
  );
}

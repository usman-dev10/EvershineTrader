"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import { ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { liveApi } from "@/lib/api/live";
import type { DutyStatus, Machine, Shift, Supervisor, Worker } from "@/types/domain";
import {
  JobsPageClient,
  type JobListItem,
} from "@/components/employee/jobs-page-client";
import {
  ShiftFormFields,
  confirmDeleteShift,
  findSupervisor,
  nextDay,
  timeFromIso,
  toIso,
  type ShiftCode,
  type ShiftFormValues,
} from "@/components/employee/shift-form-fields";

type DutyRow = {
  worker: Worker;
  duty_status: DutyStatus;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function ShiftDutyClient({
  shift,
  rows,
  allMachines,
  jobs,
  supervisors,
  readOnly,
  onSaved,
  onShiftUpdated,
}: {
  shift: Shift;
  rows: DutyRow[];
  allMachines: Machine[];
  jobs: JobListItem[];
  supervisors: Supervisor[];
  readOnly: boolean;
  onSaved?: () => Promise<void> | void;
  onShiftUpdated?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [duty, setDuty] = useState<Record<string, DutyStatus>>({});
  const [pending, setPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shiftCode, setShiftCode] = useState<ShiftCode>(
    shift.name === "B" ? "B" : "A",
  );
  const [form, setForm] = useState<ShiftFormValues>({
    shift_date: shift.shift_date,
    start_time: timeFromIso(shift.start_time),
    end_time: timeFromIso(shift.end_time),
    supervisor_id: shift.supervisor_id ?? "",
    machine_ids: (shift.machines ?? []).map((m) => m.id),
  });

  useEffect(() => {
    setDuty(Object.fromEntries(rows.map((r) => [r.worker.id, r.duty_status])));
  }, [rows]);

  useEffect(() => {
    setShiftCode(shift.name === "B" ? "B" : "A");
    setForm({
      shift_date: shift.shift_date,
      start_time: timeFromIso(shift.start_time),
      end_time: timeFromIso(shift.end_time),
      supervisor_id: shift.supervisor_id ?? "",
      machine_ids: (shift.machines ?? []).map((m) => m.id),
    });
  }, [shift]);

  const imranId = useMemo(
    () => findSupervisor(supervisors, "Imran"),
    [supervisors],
  );
  const sulemanId = useMemo(
    () => findSupervisor(supervisors, "Suleman"),
    [supervisors],
  );

  function onShiftCode(code: ShiftCode) {
    setShiftCode(code);
    setForm((prev) => ({
      ...prev,
      start_time: code === "A" ? "08:00" : "20:00",
      end_time: code === "A" ? "20:00" : "08:00",
      supervisor_id:
        (code === "A" ? imranId : sulemanId) || prev.supervisor_id,
    }));
  }

  async function saveDuty() {
    setPending(true);
    try {
      await liveApi(`/shifts/${shift.id}/workers`, {
        method: "POST",
        body: JSON.stringify({
          workers: Object.entries(duty).map(([worker_id, duty_status]) => ({
            worker_id,
            duty_status,
          })),
        }),
      });
      show("success", "Duty roster saved.");
      await onSaved?.();
      window.location.href = "/employee/shifts";
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to save duty.");
    } finally {
      setPending(false);
    }
  }

  async function closeShift() {
    const ok = window.confirm(
      "Closing this shift will lock it from new jobs and piles. Continue?",
    );
    if (!ok) return;
    setPending(true);
    try {
      await liveApi(`/shifts/${shift.id}/close`, { method: "POST" });
      show("success", "Shift closed.");
      window.location.href = "/employee/shifts";
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to close shift.");
    } finally {
      setPending(false);
    }
  }

  async function deleteShift() {
    if (!confirmDeleteShift(shift)) return;
    setPending(true);
    try {
      await liveApi(`/shifts/${shift.id}`, { method: "DELETE" });
      show("success", "Shift deleted.");
      router.push("/employee/shifts");
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to delete shift.");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit() {
    if (!form.shift_date || !form.start_time || !form.end_time || !form.supervisor_id) {
      show("error", "Please complete all required fields.");
      return;
    }
    if (form.machine_ids.length === 0) {
      show("error", "Select at least one machine for this shift.");
      return;
    }
    setPending(true);
    try {
      const endDate =
        shiftCode === "B" && form.end_time <= form.start_time
          ? nextDay(form.shift_date)
          : form.shift_date;
      await liveApi(`/shifts/${shift.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: shiftCode,
          shift_date: form.shift_date,
          start_time: toIso(form.shift_date, form.start_time),
          end_time: toIso(endDate, form.end_time),
          supervisor_id: form.supervisor_id,
          machine_ids: form.machine_ids,
        }),
      });
      show("success", "Shift updated.");
      setEditOpen(false);
      await onShiftUpdated?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to update shift.");
    } finally {
      setPending(false);
    }
  }

  const machineLabel =
    (shift.machines ?? []).length > 0
      ? (shift.machines ?? [])
          .map((m) => `${m.machine_number} · ${m.name}`)
          .join(", ")
      : "None selected";

  const jobMachines =
    (shift.machines ?? []).length > 0 ? (shift.machines ?? []) : allMachines;

  return (
    <>
      <PageHeader
        title={`Shift ${shift.name}`}
        description="Shift details, jobs, machines, and worker duty."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" onClick={() => void deleteShift()} disabled={pending}>
              Delete
            </Button>
            {!readOnly ? (
              <>
                <Button variant="danger" onClick={closeShift} disabled={pending}>
                  Closed
                </Button>
                <Button onClick={saveDuty} disabled={pending}>
                  {pending ? "Saving…" : "Save duty"}
                </Button>
              </>
            ) : (
              <Badge tone="neutral">Closed · duty read-only</Badge>
            )}
          </>
        }
      />

      <section className="mb-6 rounded-2xl border border-[var(--line)] bg-white p-5">
        <JobsPageClient
          jobs={jobs}
          machines={jobMachines}
          hasOpenShift
          canCreate
          basePath="/employee/jobs"
          targetShiftId={shift.id}
          embedded
          onCreated={onShiftUpdated}
        />
      </section>

      <section className="mb-6 rounded-2xl border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={shift.status === "open" ? "success" : "neutral"}>
            {shift.status}
          </Badge>
          {!readOnly ? (
            <Button size="sm" variant="danger" onClick={closeShift} disabled={pending}>
              Closed
            </Button>
          ) : null}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Shift</dt>
            <dd className="font-medium">{shift.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Date</dt>
            <dd className="font-medium">{shift.shift_date}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Opened at
            </dt>
            <dd className="font-medium">{formatWhen(shift.opened_at ?? shift.start_time)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Supervisor
            </dt>
            <dd className="font-medium">{shift.supervisor_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Original time
            </dt>
            <dd className="font-medium">
              {formatWhen(shift.original_start_time)} →{" "}
              {formatWhen(shift.original_end_time)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Current time
            </dt>
            <dd className="font-medium">
              {formatWhen(shift.start_time)} → {formatWhen(shift.end_time)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Machines running
            </dt>
            <dd className="font-medium">{machineLabel}</dd>
          </div>
        </dl>
      </section>

      <DataTable headers={["Worker", "Code", "Duty", "Status"]}>
        {rows.map(({ worker }) => (
          <tr key={worker.id}>
            <Td className="font-medium">{worker.name}</Td>
            <Td>{worker.worker_code}</Td>
            <Td>
              <div className="flex items-center gap-3">
                <Toggle
                  label={`Duty for ${worker.name}`}
                  checked={duty[worker.id] === "on"}
                  disabled={readOnly || worker.status !== "active"}
                  onChange={(next) =>
                    setDuty((prev) => ({
                      ...prev,
                      [worker.id]: next ? "on" : "off",
                    }))
                  }
                />
                <span className="text-sm text-[var(--muted)]">
                  {duty[worker.id] === "on" ? "ON" : "OFF"}
                </span>
              </div>
            </Td>
            <Td>
              <Badge tone={worker.status === "active" ? "success" : "neutral"}>
                {worker.status}
              </Badge>
            </Td>
          </tr>
        ))}
      </DataTable>

      <Modal
        open={editOpen}
        title="Edit shift"
        onClose={() => setEditOpen(false)}
        onSubmit={saveEdit}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <ShiftFormFields
          shiftCode={shiftCode}
          onShiftCode={onShiftCode}
          form={form}
          setForm={setForm}
          supervisors={supervisors}
          machines={allMachines}
        />
      </Modal>
      <ToastBanner toast={toast} />
    </>
  );
}

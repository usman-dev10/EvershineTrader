"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import { ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { liveApi } from "@/lib/api/live";
import type { DutyStatus, Machine, Shift, Worker } from "@/types/domain";

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

function toTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toIsoOnDate(dateStr: string, time: string): string {
  return new Date(`${dateStr}T${time}:00`).toISOString();
}

export function ShiftDutyClient({
  shift,
  rows,
  allMachines,
  readOnly,
  onSaved,
  onShiftUpdated,
}: {
  shift: Shift;
  rows: DutyRow[];
  allMachines: Machine[];
  readOnly: boolean;
  onSaved?: () => Promise<void> | void;
  onShiftUpdated?: () => Promise<void> | void;
}) {
  const { toast, show } = useToast();
  const [duty, setDuty] = useState<Record<string, DutyStatus>>({});
  const [pending, setPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [startTime, setStartTime] = useState(toTimeInput(shift.start_time));
  const [endTime, setEndTime] = useState(toTimeInput(shift.end_time));
  const [machineIds, setMachineIds] = useState(
    (shift.machines ?? []).map((m) => m.id),
  );

  useEffect(() => {
    setDuty(Object.fromEntries(rows.map((r) => [r.worker.id, r.duty_status])));
  }, [rows]);

  useEffect(() => {
    setStartTime(toTimeInput(shift.start_time));
    setEndTime(toTimeInput(shift.end_time));
    setMachineIds((shift.machines ?? []).map((m) => m.id));
  }, [shift]);

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

  async function saveEdit() {
    if (!startTime || !endTime) {
      show("error", "Enter start and end time.");
      return;
    }
    setPending(true);
    try {
      let endDate = shift.shift_date;
      if (shift.name === "B" && endTime <= startTime) {
        const d = new Date(`${shift.shift_date}T12:00:00`);
        d.setDate(d.getDate() + 1);
        endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      await liveApi(`/shifts/${shift.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          start_time: toIsoOnDate(shift.shift_date, startTime),
          end_time: toIsoOnDate(endDate, endTime),
          machine_ids: machineIds,
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

  return (
    <>
      <PageHeader
        title={`Shift ${shift.name}`}
        description="Shift details, machines, and worker duty."
        actions={
          !readOnly ? (
            <>
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button variant="danger" onClick={closeShift} disabled={pending}>
                Closed
              </Button>
              <Button onClick={saveDuty} disabled={pending}>
                {pending ? "Saving…" : "Save duty"}
              </Button>
            </>
          ) : (
            <Badge tone="neutral">Closed · read-only</Badge>
          )
        }
      />

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
        title="Edit shift time"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          Original: {formatWhen(shift.original_start_time)} →{" "}
          {formatWhen(shift.original_end_time)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Start time"
            name="start_time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="End time"
            name="end_time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div className="space-y-2 rounded-lg border border-[var(--line)] p-3">
          <p className="text-sm font-medium">Machine number</p>
          {allMachines.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={machineIds.includes(m.id)}
                onChange={() =>
                  setMachineIds((prev) =>
                    prev.includes(m.id)
                      ? prev.filter((id) => id !== m.id)
                      : [...prev, m.id],
                  )
                }
              />
              {m.machine_number} · {m.name}
            </label>
          ))}
        </div>
      </Modal>
      <ToastBanner toast={toast} />
    </>
  );
}

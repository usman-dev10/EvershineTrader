"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Machine, Supervisor } from "@/types/domain";

export type ShiftCode = "A" | "B";

export type ShiftFormValues = {
  shift_date: string;
  start_time: string;
  end_time: string;
  supervisor_id: string;
  machine_ids: string[];
};

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function findSupervisor(supervisors: Supervisor[], name: string): string {
  const found = supervisors.find(
    (s) => s.name.toLowerCase() === name.toLowerCase() && s.status === "active",
  );
  return found?.id ?? "";
}

export function confirmDeleteShift(shift: { name: string; shift_date: string }): boolean {
  return window.confirm(
    `Delete Shift ${shift.name} (${shift.shift_date})?\n\nThis permanently removes this shift and all related jobs, worker piles, duty, and machines. This cannot be undone.`,
  );
}

export function timeFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ShiftFormFields({
  shiftCode,
  onShiftCode,
  form,
  setForm,
  supervisors,
  machines,
}: {
  shiftCode: ShiftCode;
  onShiftCode: (code: ShiftCode) => void;
  form: ShiftFormValues;
  setForm: (next: ShiftFormValues) => void;
  supervisors: Supervisor[];
  machines: Machine[];
}) {
  function toggleMachine(id: string) {
    setForm({
      ...form,
      machine_ids: form.machine_ids.includes(id)
        ? form.machine_ids.filter((x) => x !== id)
        : [...form.machine_ids, id],
    });
  }

  return (
    <>
      <div className="space-y-2 rounded-lg border border-[var(--line)] p-3">
        <p className="text-sm font-medium">Shift</p>
        <div className="flex gap-4">
          {(["A", "B"] as const).map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={shiftCode === code}
                onChange={() => onShiftCode(code)}
              />
              {code}
            </label>
          ))}
        </div>
      </div>

      <Input
        label="Date"
        name="shift_date"
        type="date"
        value={form.shift_date}
        onChange={(e) => setForm({ ...form, shift_date: e.target.value })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Start time"
          name="start_time"
          type="time"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
        />
        <Input
          label="End time"
          name="end_time"
          type="time"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
        />
      </div>
      <Select
        label="Supervisor"
        name="supervisor_id"
        value={form.supervisor_id}
        onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}
        options={supervisors
          .filter((s) => ["Imran", "Suleman"].includes(s.name))
          .map((s) => ({ value: s.id, label: s.name }))}
      />

      <div className="space-y-2 rounded-lg border border-[var(--line)] p-3">
        <p className="text-sm font-medium">Machine number</p>
        {machines.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">
            No machines yet. Add machines from company Manage first.
          </p>
        ) : (
          machines.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.machine_ids.includes(m.id)}
                onChange={() => toggleMachine(m.id)}
              />
              {m.machine_number} · {m.name}
            </label>
          ))
        )}
      </div>
    </>
  );
}

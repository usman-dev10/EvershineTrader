"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Modal } from "@/components/ui/modal";
import { ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { liveApi } from "@/lib/api/live";
import type { Machine, Shift, Supervisor } from "@/types/domain";
import {
  ShiftFormFields,
  confirmDeleteShift,
  findSupervisor,
  nextDay,
  todayLocal,
  toIso,
  type ShiftCode,
  type ShiftFormValues,
} from "@/components/employee/shift-form-fields";

export function ShiftsPageClient({
  shifts,
  supervisors,
  machines,
  hasOpenShift,
  canCreate,
  onCreated,
}: {
  shifts: Shift[];
  supervisors: Supervisor[];
  machines: Machine[];
  hasOpenShift: boolean;
  canCreate: boolean;
  onCreated?: () => Promise<void> | void;
}) {
  const { toast, show } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shiftCode, setShiftCode] = useState<ShiftCode>("A");
  const [supervisorList, setSupervisorList] = useState(supervisors);
  const [form, setForm] = useState<ShiftFormValues>({
    shift_date: todayLocal(),
    start_time: "08:00",
    end_time: "20:00",
    supervisor_id: "",
    machine_ids: [],
  });

  useEffect(() => {
    setSupervisorList(supervisors);
  }, [supervisors]);

  const imranId = useMemo(
    () => findSupervisor(supervisorList, "Imran"),
    [supervisorList],
  );
  const sulemanId = useMemo(
    () => findSupervisor(supervisorList, "Suleman"),
    [supervisorList],
  );

  function applyShiftDefaults(code: ShiftCode) {
    const date = todayLocal();
    if (code === "A") {
      setForm((prev) => ({
        ...prev,
        shift_date: date,
        start_time: "08:00",
        end_time: "20:00",
        supervisor_id: imranId || prev.supervisor_id,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        shift_date: date,
        start_time: "20:00",
        end_time: "08:00",
        supervisor_id: sulemanId || prev.supervisor_id,
      }));
    }
  }

  async function onCreateClick() {
    if (hasOpenShift) {
      show("error", "A shift is currently open. Close it before opening a new one.");
      return;
    }

    let list = supervisorList;
    if (!findSupervisor(list, "Imran") || !findSupervisor(list, "Suleman")) {
      try {
        list = await liveApi<Supervisor[]>("/floor/supervisors");
        setSupervisorList(list);
      } catch (err) {
        show(
          "error",
          err instanceof Error
            ? err.message
            : "Unable to load supervisors Imran and Suleman.",
        );
        return;
      }
    }

    const imran = findSupervisor(list, "Imran");
    const suleman = findSupervisor(list, "Suleman");
    if (!imran || !suleman) {
      show("error", "Supervisors Imran and Suleman could not be loaded.");
      return;
    }

    setShiftCode("A");
    setForm({
      shift_date: todayLocal(),
      start_time: "08:00",
      end_time: "20:00",
      supervisor_id: imran,
      machine_ids: [],
    });
    setOpen(true);
  }

  async function submit() {
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
      const created = await liveApi<Shift>("/shifts", {
        method: "POST",
        body: JSON.stringify({
          name: shiftCode,
          shift_date: form.shift_date,
          start_time: toIso(form.shift_date, form.start_time),
          end_time: toIso(endDate, form.end_time),
          supervisor_id: form.supervisor_id,
          machine_ids: form.machine_ids,
        }),
      });
      show("success", `Shift ${shiftCode} opened.`);
      setOpen(false);
      await onCreated?.();
      if (created?.id) {
        window.location.href = `/employee/shifts/${created.id}`;
        return;
      }
      show("error", "Shift opened but detail link was missing. Refresh the shifts list.");
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to open shift.");
    } finally {
      setPending(false);
    }
  }

  async function closeShift(id: string) {
    const ok = window.confirm("Close this shift? New jobs and piles will be locked.");
    if (!ok) return;
    setClosingId(id);
    try {
      await liveApi(`/shifts/${id}/close`, { method: "POST" });
      show("success", "Shift closed.");
      await onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to close shift.";
      if (/already closed|not found/i.test(message)) {
        show("success", "Shift is already closed.");
        await onCreated?.();
      } else {
        show("error", message);
      }
    } finally {
      setClosingId(null);
    }
  }

  async function deleteShift(shift: Shift) {
    if (!confirmDeleteShift(shift)) return;
    setDeletingId(shift.id);
    try {
      await liveApi(`/shifts/${shift.id}`, { method: "DELETE" });
      show("success", "Shift deleted.");
      await onCreated?.();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to delete shift.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Shifts"
        description="Open shift A or B. Only one shift can be open at a time."
        actions={
          canCreate ? (
            <Button onClick={() => void onCreateClick()} disabled={hasOpenShift}>
              New shift
            </Button>
          ) : undefined
        }
      />

      {shifts.length === 0 ? (
        <EmptyState
          title="No shifts yet"
          description="Open the first shift to start floor work."
          action={
            canCreate ? (
              <Button onClick={() => void onCreateClick()}>New shift</Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable headers={["Shift", "Date", "Status", ""]}>
          {shifts.map((shift) => (
            <tr key={shift.id}>
              <Td className="font-medium">{shift.name}</Td>
              <Td>{shift.shift_date}</Td>
              <Td>
                <Badge tone={statusTone(shift.status)}>{shift.status}</Badge>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/employee/shifts/${shift.id}`}>
                    <Button size="sm" variant="secondary">
                      Detail
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deletingId === shift.id}
                    onClick={() => void deleteShift(shift)}
                  >
                    {deletingId === shift.id ? "Deleting…" : "Delete"}
                  </Button>
                  {shift.status === "open" ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={closingId === shift.id}
                      onClick={() => void closeShift(shift.id)}
                    >
                      {closingId === shift.id ? "Closing…" : "Closed"}
                    </Button>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal
        open={open}
        title="Open shift"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Opening…" : "Open shift"}
            </Button>
          </>
        }
      >
        <ShiftFormFields
          shiftCode={shiftCode}
          onShiftCode={(code) => {
            setShiftCode(code);
            applyShiftDefaults(code);
          }}
          form={form}
          setForm={setForm}
          supervisors={supervisorList}
          machines={machines}
        />
      </Modal>
      <ToastBanner toast={toast} />
    </>
  );
}

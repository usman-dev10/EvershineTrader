"use client";

import { useCallback, useEffect, useState } from "react";
import { ManageBackLink } from "@/components/company/manage-back-link";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { AlertBanner, ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { liveApi } from "@/lib/api/live";
import { staffEmployeeFormSchema } from "@/lib/validations/forms";

type StaffEmployee = {
  id: string;
  full_name: string;
  father_name: string;
  cnic: string;
  phone: string;
  position: string;
  salary: number;
  is_worker: boolean;
  is_supervisor: boolean;
  joining_date: string;
};

const emptyForm = {
  full_name: "",
  father_name: "",
  cnic: "",
  phone: "",
  position: "Salary" as "Contract" | "Salary",
  salary: "",
  is_worker: false,
  is_supervisor: false,
  joining_date: "",
};

export default function EmployeesManagePage() {
  const { toast, show } = useToast();
  const [rows, setRows] = useState<StaffEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      setRows(await liveApi<StaffEmployee[]>("/employees"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load employees.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setMode("create");
    setEditId(null);
    setForm(emptyForm);
    setFieldErrors({});
  }

  function openEdit(row: StaffEmployee) {
    setMode("edit");
    setEditId(row.id);
    setForm({
      full_name: row.full_name,
      father_name: row.father_name,
      cnic: row.cnic,
      phone: row.phone,
      position: (row.position === "Contract" ? "Contract" : "Salary") as
        | "Contract"
        | "Salary",
      salary: String(row.salary ?? 0),
      is_worker: row.is_worker,
      is_supervisor: row.is_supervisor,
      joining_date: row.joining_date?.slice(0, 10) ?? "",
    });
    setFieldErrors({});
  }

  async function submit() {
    setFieldErrors({});
    const parsed = staffEmployeeFormSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        next[String(i.path[0] ?? "form")] = i.message;
      });
      setFieldErrors(next);
      return;
    }
    setPending(true);
    try {
      if (mode === "edit" && editId) {
        await liveApi(`/employees/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(parsed.data),
        });
        show("success", "Employee updated.");
      } else {
        await liveApi("/employees", {
          method: "POST",
          body: JSON.stringify(parsed.data),
        });
        show("success", "Employee saved.");
      }
      setMode(null);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ManageBackLink />
      {error ? (
        <div className="mb-4">
          <AlertBanner tone="warning">{error}</AlertBanner>
        </div>
      ) : null}
      <PageHeader
        title="Employee"
        description="Floor employees with CNIC, position, and worker/supervisor roles."
        actions={<Button onClick={openCreate}>Add employee</Button>}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Add employees to use them as workers or supervisors on the floor."
          action={<Button onClick={openCreate}>Add employee</Button>}
        />
      ) : (
        <DataTable headers={["Name", "CNIC / Phone", "Position / Salary", ""]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">
                {row.full_name}
                <div className="text-xs text-[var(--muted)]">S/O {row.father_name}</div>
              </Td>
              <Td>
                {row.cnic}
                <div className="text-xs text-[var(--muted)]">{row.phone}</div>
              </Td>
              <Td>
                {row.position}
                <div className="text-xs text-[var(--muted)]">
                  Salary {row.salary ?? 0}
                  {" · "}
                  {[row.is_worker ? "Worker" : null, row.is_supervisor ? "Supervisor" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (!window.confirm("Delete this employee?")) return;
                      try {
                        await liveApi(`/employees/${row.id}`, { method: "DELETE" });
                        show("success", "Deleted.");
                        await load();
                      } catch (err) {
                        show(
                          "error",
                          err instanceof Error ? err.message : "Unable to delete.",
                        );
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal
        open={mode !== null}
        title={mode === "edit" ? "Edit employee" : "Add employee"}
        onClose={() => {
          setMode(null);
          setEditId(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setMode(null);
                setEditId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <Input
          label="Full name"
          name="full_name"
          value={form.full_name}
          error={fieldErrors.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <Input
          label="Father name"
          name="father_name"
          value={form.father_name}
          error={fieldErrors.father_name}
          onChange={(e) => setForm({ ...form, father_name: e.target.value })}
        />
        <Input
          label="CNIC"
          name="cnic"
          placeholder="12345-1234567-1"
          value={form.cnic}
          error={fieldErrors.cnic}
          onChange={(e) => setForm({ ...form, cnic: e.target.value })}
        />
        <Input
          label="Phone number"
          name="phone"
          type="tel"
          placeholder="03XXXXXXXXX"
          value={form.phone}
          error={fieldErrors.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Select
          label="Position"
          name="position"
          value={form.position}
          placeholder="Select position"
          options={[
            { value: "Contract", label: "Contract" },
            { value: "Salary", label: "Salary" },
          ]}
          onChange={(e) =>
            setForm({
              ...form,
              position: e.target.value as "Contract" | "Salary",
            })
          }
        />
        <Input
          label="Salary"
          name="salary"
          type="number"
          min={0}
          step={1}
          value={form.salary}
          error={fieldErrors.salary}
          onChange={(e) => setForm({ ...form, salary: e.target.value })}
          hint="Whole number amount"
        />
        <div className="space-y-2 rounded-lg border border-[var(--line)] p-3">
          <p className="text-sm font-medium">Role</p>
          {fieldErrors.is_worker ? (
            <p className="text-xs text-[var(--danger)]">{fieldErrors.is_worker}</p>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_worker}
              onChange={(e) => setForm({ ...form, is_worker: e.target.checked })}
            />
            Worker
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_supervisor}
              onChange={(e) => setForm({ ...form, is_supervisor: e.target.checked })}
            />
            Supervisor
          </label>
        </div>
        <Input
          label="Joining date"
          name="joining_date"
          type="date"
          value={form.joining_date}
          error={fieldErrors.joining_date}
          onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
        />
      </Modal>
      <ToastBanner toast={toast} />
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ManageBackLink } from "@/components/company/manage-back-link";
import {
  ManageCrudPage,
  type ManageRow,
} from "@/components/company/manage-crud-page";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import { machineFormSchema } from "@/lib/validations/forms";

type Machine = { id: string; machine_number: string; name: string };

export default function MachinesManagePage() {
  const [rows, setRows] = useState<ManageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await liveApi<Machine[]>("/machines");
      setRows(
        data.map((m) => ({
          id: m.id,
          primary: m.machine_number,
          secondary: m.name,
          values: { machine_number: m.machine_number, name: m.name },
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load machines.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <ManageBackLink />
      {error ? (
        <div className="mb-4">
          <AlertBanner tone="warning">{error}</AlertBanner>
        </div>
      ) : null}
      <ManageCrudPage
        title="Machines"
        description="Machines used for jobs and monthly machine reports."
        headers={["Machine Number", "Machine Name", ""]}
        rows={rows}
        hideStatus
        addLabel="Add machine"
        fields={[
          { name: "machine_number", label: "Machine Number", required: true },
          { name: "name", label: "Machine Name", required: true },
        ]}
        onCreate={async (values) => {
          const parsed = machineFormSchema.safeParse(values);
          if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? "Invalid form.");
          }
          await liveApi("/machines", {
            method: "POST",
            body: JSON.stringify(parsed.data),
          });
          await load();
        }}
        onUpdate={async (id, values) => {
          const parsed = machineFormSchema.safeParse(values);
          if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? "Invalid form.");
          }
          await liveApi(`/machines/${id}`, {
            method: "PATCH",
            body: JSON.stringify(parsed.data),
          });
          await load();
        }}
        onDelete={async (id) => {
          await liveApi(`/machines/${id}`, { method: "DELETE" });
          await load();
        }}
      />
    </>
  );
}

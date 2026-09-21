"use client";

import { useState } from "react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";

export type ManageRow = {
  id: string;
  primary: string;
  secondary?: string;
  status?: string;
  values?: Record<string, string>;
};

type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "password" | "date" | "tel";
  required?: boolean;
  hint?: string;
  editOptional?: boolean;
};

export function ManageCrudPage({
  title,
  description,
  headers,
  rows,
  fields,
  onCreate,
  onUpdate,
  onDelete,
  hideStatus,
  hideSecondary,
  addLabel,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: ManageRow[];
  fields: FieldDef[];
  onCreate?: (values: Record<string, string>) => Promise<void>;
  onUpdate?: (id: string, values: Record<string, string>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  hideStatus?: boolean;
  hideSecondary?: boolean;
  addLabel?: string;
}) {
  const { toast, show } = useToast();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  function openCreate() {
    setMode("create");
    setEditId(null);
    setValues({});
  }

  function openEdit(row: ManageRow) {
    setMode("edit");
    setEditId(row.id);
    setValues(row.values ?? { name: row.primary, phone: row.primary });
  }

  async function submit() {
    setPending(true);
    try {
      if (mode === "create") {
        if (!onCreate) return;
        await onCreate(values);
        show("success", "Saved successfully.");
      } else if (mode === "edit" && editId) {
        if (!onUpdate) return;
        await onUpdate(editId, values);
        show("success", "Updated successfully.");
      }
      setMode(null);
      setEditId(null);
      setValues({});
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          onCreate ? (
            <Button onClick={openCreate}>{addLabel ?? "Add new"}</Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={`No ${title.toLowerCase()} yet`}
          description="Add records here to use them across the product."
          action={onCreate ? <Button onClick={openCreate}>{addLabel ?? "Add new"}</Button> : undefined}
        />
      ) : (
        <DataTable headers={headers}>
          {rows.map((row) => (
            <tr key={row.id}>
              <Td className="font-medium">{row.primary}</Td>
              {!hideSecondary ? <Td>{row.secondary}</Td> : null}
              {!hideStatus && row.status ? (
                <Td>
                  <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                </Td>
              ) : null}
              <Td>
                <div className="flex flex-wrap gap-2">
                  {onUpdate ? (
                    <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        const ok = window.confirm("Delete this record permanently?");
                        if (!ok) return;
                        try {
                          await onDelete(row.id);
                          show("success", "Deleted.");
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
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal
        open={mode !== null}
        title={mode === "edit" ? `Edit ${title}` : `Add ${title}`}
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
        {fields.map((field) => (
          <Input
            key={field.name}
            label={field.label}
            name={field.name}
            type={field.type ?? "text"}
            required={
              mode === "edit" && field.editOptional ? false : field.required
            }
            hint={
              mode === "edit" && field.editOptional
                ? field.hint ?? "Leave blank to keep current password"
                : field.hint
            }
            value={values[field.name] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
            }
          />
        ))}
      </Modal>
      <ToastBanner toast={toast} />
    </>
  );
}

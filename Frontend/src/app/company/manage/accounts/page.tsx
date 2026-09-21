"use client";

import { useCallback, useEffect, useState } from "react";
import { ManageBackLink } from "@/components/company/manage-back-link";
import {
  ManageCrudPage,
  type ManageRow,
} from "@/components/company/manage-crud-page";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import { accountFormSchema } from "@/lib/validations/forms";
import { z } from "zod";

type Account = { id: string; phone: string; role: string };

const accountUpdateSchema = z.object({
  phone: accountFormSchema.shape.phone,
  password: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v : undefined))
    .refine((v) => v === undefined || v.length >= 8, {
      message: "Password must be at least 8 characters.",
    }),
});

export default function CreateAccountPage() {
  const [rows, setRows] = useState<ManageRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await liveApi<Account[]>("/accounts");
      setRows(
        data.map((a) => ({
          id: a.id,
          primary: a.phone,
          secondary: a.role,
          values: { phone: a.phone, password: "" },
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load accounts.");
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
        title="Create Account"
        description="Create login accounts using phone number and password only."
        headers={["Phone", "Role", ""]}
        rows={rows}
        hideStatus
        fields={[
          { name: "phone", label: "Phone number", type: "tel", required: true },
          {
            name: "password",
            label: "Password",
            type: "password",
            required: true,
            editOptional: true,
          },
        ]}
        onCreate={async (values) => {
          const parsed = accountFormSchema.safeParse(values);
          if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? "Invalid form.");
          }
          await liveApi("/accounts", {
            method: "POST",
            body: JSON.stringify(parsed.data),
          });
          await load();
        }}
        onUpdate={async (id, values) => {
          const parsed = accountUpdateSchema.safeParse(values);
          if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? "Invalid form.");
          }
          await liveApi(`/accounts/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
              phone: parsed.data.phone,
              password: parsed.data.password ?? null,
            }),
          });
          await load();
        }}
        onDelete={async (id) => {
          await liveApi(`/accounts/${id}`, { method: "DELETE" });
          await load();
        }}
      />
    </>
  );
}

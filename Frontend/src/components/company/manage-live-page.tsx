"use client";

import { useCallback, useEffect, useState } from "react";
import { ManageBackLink } from "@/components/company/manage-back-link";
import {
  ManageCrudPage,
  type ManageRow,
} from "@/components/company/manage-crud-page";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";

type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "number";
  required?: boolean;
};

export function ManageLivePage({
  title,
  description,
  headers,
  resourcePath,
  fields,
  mapRow,
  buildCreateBody,
}: {
  title: string;
  description: string;
  headers: string[];
  resourcePath: string;
  fields: FieldDef[];
  mapRow: (item: Record<string, unknown>) => ManageRow;
  buildCreateBody: (values: Record<string, string>) => Record<string, unknown>;
}) {
  const [rows, setRows] = useState<ManageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await liveApi<Record<string, unknown>[]>(resourcePath);
      setRows(data.map(mapRow));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [resourcePath, mapRow]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <ManageBackLink />
      {loadError ? (
        <div className="mb-4">
          <AlertBanner tone="warning">{loadError}</AlertBanner>
        </div>
      ) : null}
      {loading && rows.length === 0 && !loadError ? (
        <p className="mb-4 text-sm text-[var(--muted)]">Loading…</p>
      ) : null}
      <ManageCrudPage
        title={title}
        description={description}
        headers={headers}
        rows={rows}
        fields={fields}
        onCreate={async (values) => {
          await liveApi(resourcePath, {
            method: "POST",
            body: JSON.stringify(buildCreateBody(values)),
          });
          await load();
        }}
        onToggleStatus={async (id, next) => {
          await liveApi(`${resourcePath}/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: next }),
          });
          await load();
        }}
      />
    </>
  );
}

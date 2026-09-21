"use client";

import { useEffect, useState } from "react";
import { EmployeeDashboardView } from "@/components/employee/dashboard-view";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import type { EmployeeDashboard } from "@/types/domain";

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<EmployeeDashboard | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const dashboard = await liveApi<EmployeeDashboard>("/dashboard/employee");
        setData(dashboard);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      }
    })();
  }, []);

  return (
    <>
      {error ? (
        <div className="mb-4">
          <AlertBanner tone="warning">{error}</AlertBanner>
        </div>
      ) : null}
      <EmployeeDashboardView data={data} />
    </>
  );
}

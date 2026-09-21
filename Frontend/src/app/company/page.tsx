"use client";

import { useEffect, useState } from "react";
import { CompanyDashboardView } from "@/components/company/dashboard-view";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import type { CompanyDashboard } from "@/types/domain";

export default function CompanyDashboardPage() {
  const [data, setData] = useState<CompanyDashboard | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const dashboard = await liveApi<CompanyDashboard>("/dashboard/company");
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
      <CompanyDashboardView data={data} />
    </>
  );
}

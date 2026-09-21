import type { CompanyDashboard } from "@/types/domain";
import { MetricCard, PageHeader } from "@/components/ui/page";
import { MachineWorkerUpsCharts } from "@/components/company/machine-worker-ups-charts";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const emptyDashboard: CompanyDashboard = {
  total_employees: 0,
  total_accounts: 0,
  total_machines: 0,
  total_workers: 0,
  active_shift: null,
  open_jobs: 0,
  total_sheets: 0,
  allocated_sheets: 0,
  remaining_sheets: 0,
  recent_activity: [],
  shift_worker_sheets: [],
  machine_ups_charts: [],
};

export function CompanyDashboardView({
  data = emptyDashboard,
}: {
  data?: CompanyDashboard;
}) {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your company floor setup."
        actions={
          <Link href="/company/manage">
            <Button>Open Manage</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Employees" value={data.total_employees} />
        <MetricCard label="Accounts" value={data.total_accounts} />
        <MetricCard label="Machines" value={data.total_machines} />
      </div>

      <MachineWorkerUpsCharts charts={data.machine_ups_charts ?? []} />
    </>
  );
}

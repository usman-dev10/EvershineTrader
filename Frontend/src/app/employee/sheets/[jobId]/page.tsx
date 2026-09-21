import { SheetsWorkClient } from "@/components/employee/sheets-work-client";

export const metadata = { title: "Job work view" };

export default async function EmployeeJobWorkPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return (
    <SheetsWorkClient
      machines={[]}
      jobs={[
        {
          id: jobId,
          company_id: "",
          shift_id: "",
          machine_id: "",
          job_number: "—",
          job_name: "Selected job",
          total_sheets: 0,
          dabbi: false,
          ups: null,
          status: "open",
          allocated_sheets: 0,
          remaining_sheets: 0,
        },
      ]}
      workers={[]}
      selectedJob={{
        id: jobId,
        company_id: "",
        shift_id: "",
        machine_id: "",
        job_number: "—",
        job_name: "Selected job",
        total_sheets: 0,
        dabbi: false,
        ups: null,
        status: "open",
        allocated_sheets: 0,
        remaining_sheets: 0,
      }}
    />
  );
}

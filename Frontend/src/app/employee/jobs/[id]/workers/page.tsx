import { JobWorkersClient } from "@/components/employee/job-workers-client";

export const metadata = { title: "Job workers" };

export default async function EmployeeJobWorkersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobWorkersClient jobId={id} basePath="/employee/jobs" />;
}

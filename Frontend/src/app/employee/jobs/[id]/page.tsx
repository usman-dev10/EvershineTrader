import { JobDetailClient } from "@/components/employee/job-detail-client";

export const metadata = { title: "Job detail" };

export default async function EmployeeJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobDetailClient jobId={id} basePath="/employee/jobs" />;
}

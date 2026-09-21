"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, PageHeader } from "@/components/ui/page";
import { AlertBanner } from "@/components/ui/feedback";
import { liveApi } from "@/lib/api/live";
import { formatNumber } from "@/lib/utils";
import type { Job } from "@/types/domain";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--line)] py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--ink)]">{value}</dd>
    </div>
  );
}

export function JobDetailClient({
  jobId,
  basePath = "/employee/jobs",
}: {
  jobId: string;
  basePath?: "/employee/jobs" | "/company/jobs";
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await liveApi<Job>(`/jobs/${jobId}`);
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load job.");
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <>
        <PageHeader
          title="Job detail"
          actions={
            <Link href={basePath}>
              <Button variant="secondary">Previous</Button>
            </Link>
          }
        />
        <AlertBanner tone="warning">{error}</AlertBanner>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <PageHeader title="Job detail" />
        <EmptyState title="Loading…" description="Fetching job details." />
      </>
    );
  }

  const machine =
    job.machine_number || job.machine_name
      ? `${job.machine_number ?? ""} · ${job.machine_name ?? ""}`.replace(
          /^ · | · $/g,
          "",
        )
      : "—";

  return (
    <>
      <PageHeader
        title={job.job_name}
        description="Full job detail"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={basePath}>
              <Button variant="secondary">Previous</Button>
            </Link>
            <Link href={`${basePath}/${job.id}/workers`}>
              <Button variant="secondary">Worker</Button>
            </Link>
            <Link href={basePath}>
              <Button variant="secondary">Back to jobs</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total sheets"
          value={
            job.total_sheets > 0 ? formatNumber(job.total_sheets) : "Unlimited"
          }
        />
        <MetricCard
          label="Break sheet"
          value={formatNumber(job.break_sheets ?? job.allocated_sheets ?? 0)}
        />
        <MetricCard
          label="Remaining"
          value={
            job.total_sheets > 0
              ? formatNumber(job.remaining_sheets ?? job.total_sheets)
              : "—"
          }
        />
        <MetricCard
          label="Completed piles"
          value={formatNumber(job.completed_pile_count ?? 0)}
        />
      </div>

      <section className="mb-6 rounded-xl border border-[var(--line)] bg-white px-4">
        <dl>
          <DetailRow label="Job name" value={job.job_name} />
          <DetailRow
            label="Job number"
            value={job.job_number?.trim() ? job.job_number : "—"}
          />
          <DetailRow label="Shift" value={job.shift_name ?? "—"} />
          <DetailRow label="Date" value={job.shift_date ?? "—"} />
          <DetailRow label="Machine" value={machine} />
          <DetailRow
            label="UPS"
            value={job.ups != null ? formatNumber(job.ups) : "—"}
          />
          <DetailRow label="Dabbi" value={job.dabbi ? "Yes" : "No"} />
          <DetailRow
            label="Status"
            value={<Badge tone={statusTone(job.status)}>{job.status}</Badge>}
          />
        </dl>
      </section>
    </>
  );
}

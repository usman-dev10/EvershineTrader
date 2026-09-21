"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DataTable, Td } from "@/components/ui/data-table";
import { EmptyState, MetricCard, PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { AlertBanner, ToastBanner } from "@/components/ui/feedback";
import { useToast } from "@/hooks/use-toast";
import { liveApi } from "@/lib/api/live";
import { formatNumber, cn } from "@/lib/utils";
import type { Job, JobPile } from "@/types/domain";

function formatClock(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  // Already YYYY-MM-DD or full ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function JobWorkersClient({
  jobId,
  basePath = "/employee/jobs",
  canEdit = true,
}: {
  jobId: string;
  basePath?: "/employee/jobs" | "/company/jobs";
  canEdit?: boolean;
}) {
  const { toast, show } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [piles, setPiles] = useState<JobPile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editPile, setEditPile] = useState<JobPile | null>(null);
  const [editSheets, setEditSheets] = useState("");
  const [deletePile, setDeletePile] = useState<JobPile | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [jobData, pileData] = await Promise.all([
        liveApi<Job>(`/jobs/${jobId}`),
        liveApi<JobPile[]>(`/jobs/${jobId}/piles`),
      ]);
      setJob(jobData);
      setPiles(pileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load workers.");
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const completed = useMemo(
    () => piles.filter((p) => p.pile_out_at),
    [piles],
  );

  const byWorker = useMemo(() => {
    const map = new Map<string, { name: string; piles: JobPile[] }>();
    for (const p of completed) {
      const key = p.worker_id;
      const entry = map.get(key) ?? {
        name: p.worker_name ?? "Worker",
        piles: [],
      };
      entry.piles.push(p);
      map.set(key, entry);
    }
    return Array.from(map.entries()).map(([workerId, value]) => ({
      workerId,
      ...value,
    }));
  }, [completed]);

  async function saveEdit() {
    if (!editPile) return;
    const sheets = Number(editSheets);
    if (!Number.isInteger(sheets) || sheets <= 0) {
      show("error", "Enter a valid sheets number.");
      return;
    }
    setPending(true);
    try {
      await liveApi(`/jobs/${jobId}/piles/${editPile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sheets }),
      });
      show("success", "Sheets updated.");
      setEditPile(null);
      await load();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to update.");
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deletePile) return;
    setPending(true);
    try {
      await liveApi(`/jobs/${jobId}/piles/${deletePile.id}`, {
        method: "DELETE",
      });
      show("success", "Pile deleted.");
      setDeletePile(null);
      await load();
    } catch (err) {
      show("error", err instanceof Error ? err.message : "Unable to delete.");
    } finally {
      setPending(false);
    }
  }

  if (error) {
    return (
      <>
        <PageHeader
          title="Job workers"
          actions={
            <Link href={basePath}>
              <Button variant="secondary">Back to jobs</Button>
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
        <PageHeader title="Job workers" />
        <EmptyState title="Loading…" description="Fetching pile history." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Workers · ${job.job_name}`}
        description={`${job.shift_name ?? "Shift"} · ${job.shift_date ?? "—"} — piles with date and time. Rows from another shift are highlighted.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`${basePath}/${job.id}`}>
              <Button variant="secondary">View job</Button>
            </Link>
            <Link href={basePath}>
              <Button variant="secondary">Back to jobs</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Job No"
          value={job.job_number?.trim() ? job.job_number : "—"}
        />
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
      </div>

      {byWorker.length === 0 ? (
        <EmptyState
          title="No completed piles yet"
          description="When workers press Out on Sheets, pile series appear here."
        />
      ) : (
        <div className="space-y-8">
          {byWorker.map((group) => (
            <section key={group.workerId}>
              <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
                {group.name}
              </h2>
              <DataTable
                headers={[
                  "Pile series",
                  "Sheets",
                  "Date",
                  "Time in",
                  "Time out",
                  "Total time",
                  ...(canEdit ? [""] : []),
                ]}
              >
                {group.piles.map((pile) => (
                  <tr
                    key={pile.id}
                    className={cn(
                      pile.other_shift && "bg-amber-50/90 ring-1 ring-inset ring-amber-200",
                    )}
                    title={
                      pile.other_shift
                        ? `Broken on another shift (${pile.work_shift_name ?? "?"} · ${pile.work_shift_date ?? "—"})`
                        : undefined
                    }
                  >
                    <Td className="font-medium">
                      {pile.series_no ?? "—"}
                      {pile.other_shift ? (
                        <div className="text-xs font-normal text-amber-800">
                          Shift {pile.work_shift_name ?? "?"}
                        </div>
                      ) : null}
                    </Td>
                    <Td>{formatNumber(pile.sheets)}</Td>
                    <Td>{formatDate(pile.pile_date ?? pile.work_shift_date)}</Td>
                    <Td>{formatClock(pile.pile_in_at)}</Td>
                    <Td>{formatClock(pile.pile_out_at)}</Td>
                    <Td>{formatDuration(pile.total_seconds)}</Td>
                    {canEdit ? (
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditPile(pile);
                              setEditSheets(String(pile.sheets));
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setDeletePile(pile)}
                          >
                            Delete
                          </Button>
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </DataTable>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editPile)}
        title="Edit sheets"
        onClose={() => setEditPile(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditPile(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={pending}>
              {pending ? "Saving…" : "Save sheets"}
            </Button>
          </>
        }
      >
        <Input
          label="Sheets"
          name="sheets"
          type="number"
          min={1}
          value={editSheets}
          onChange={(e) => setEditSheets(e.target.value)}
          hint="Only sheets can be corrected here."
        />
      </Modal>

      <Modal
        open={Boolean(deletePile)}
        title="Delete pile?"
        onClose={() => setDeletePile(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletePile(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmDelete()} disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--ink)]">
          Remove pile series {deletePile?.series_no ?? ""} (
          {deletePile ? formatNumber(deletePile.sheets) : ""} sheets)? This
          updates break sheet and remaining.
        </p>
      </Modal>

      <ToastBanner toast={toast} />
    </>
  );
}

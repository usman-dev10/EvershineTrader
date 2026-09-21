"use client";

import { formatNumber } from "@/lib/utils";

export type MachineUpsChart = {
  machine_id: string;
  machine_number: string;
  machine_name: string;
  ups_values: number[];
  workers: {
    worker_id: string;
    worker_name: string;
    by_ups: Record<string, number>;
  }[];
};

/** Brand-family palette for UPS series (2, 4, 8, 16…). */
const UPS_COLORS = [
  "#0f5c42",
  "#1e7a5c",
  "#c4a035",
  "#2a6f8a",
  "#5a8f6a",
  "#8a5a2a",
];

function colorForUps(index: number): string {
  return UPS_COLORS[index % UPS_COLORS.length];
}

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(step * magnitude, 10);
}

export function MachineWorkerUpsCharts({
  charts,
}: {
  charts: MachineUpsChart[];
}) {
  if (charts.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          Machine UPS sheets
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Add machines in Manage to see per-machine charts.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {charts.map((chart) => {
        const upsList = chart.ups_values.length
          ? chart.ups_values
          : [2, 4, 8, 16];
        const maxSheets = niceMax(
          Math.max(
            ...chart.workers.flatMap((w) =>
              upsList.map((u) => w.by_ups[String(u)] ?? 0),
            ),
            0,
          ),
        );
        const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) =>
          Math.round(maxSheets * p),
        );

        return (
          <section
            key={chart.machine_id}
            className="rounded-2xl border border-[var(--line)] bg-white p-5"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                  {chart.machine_number} · {chart.machine_name}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Horizontal: workers · Vertical: sheets by UPS
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink)]">
                {upsList.map((u, i) => (
                  <span
                    key={u}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-sm ring-1 ring-[var(--ink)]/20"
                      style={{ background: colorForUps(i) }}
                    />
                    UPS {u}
                  </span>
                ))}
              </div>
            </div>

            {chart.workers.length === 0 ? (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
                No workers yet. Add employees as workers in Manage.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex min-w-[480px] gap-3">
                  <div className="flex h-56 w-14 shrink-0 flex-col justify-between py-1 text-right text-xs text-[var(--muted)]">
                    {[...ticks].reverse().map((tick) => (
                      <span key={tick}>{formatNumber(tick)}</span>
                    ))}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
                      {ticks.map((tick) => (
                        <div
                          key={tick}
                          className="border-t border-dashed border-[var(--line)]"
                        />
                      ))}
                    </div>
                    <div className="relative flex h-48 items-end gap-2 px-1 pt-4 sm:h-56 sm:gap-3">
                      {chart.workers.map((worker) => (
                        <div
                          key={worker.worker_id}
                          className="flex h-full min-w-[56px] flex-1 flex-col items-center justify-end sm:min-w-[72px]"
                          title={worker.worker_name}
                        >
                          <div className="flex h-full w-full max-w-[88px] items-end justify-center gap-0.5">
                            {upsList.map((u, i) => {
                              const sheets = worker.by_ups[String(u)] ?? 0;
                              const h = Math.max(
                                sheets > 0 ? 4 : 2,
                                (sheets / maxSheets) * 100,
                              );
                              return (
                                <div
                                  key={`${worker.worker_id}-${u}`}
                                  className="relative flex h-full w-[22%] min-w-[8px] flex-col justify-end"
                                  title={`${worker.worker_name} · UPS ${u}: ${formatNumber(sheets)}`}
                                >
                                  <div
                                    className="relative w-full rounded-t-sm ring-1 ring-[var(--ink)]/15"
                                    style={{
                                      height: `${h}%`,
                                      minHeight: sheets > 0 ? 4 : 2,
                                      background: colorForUps(i),
                                      opacity: sheets > 0 ? 1 : 0.25,
                                    }}
                                  >
                                    {sheets > 0 ? (
                                      <span className="absolute -top-3.5 left-1/2 max-w-[2.5rem] -translate-x-1/2 truncate text-[8px] font-semibold leading-none text-[var(--ink)]">
                                        {formatNumber(sheets)}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-3 px-1">
                      {chart.workers.map((worker) => (
                        <div
                          key={`${worker.worker_id}-label`}
                          className="min-w-[72px] flex-1 truncate text-center text-xs text-[var(--muted)]"
                          title={worker.worker_name}
                        >
                          {worker.worker_name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

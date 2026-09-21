"use client";

export type MachineJobPoint = {
  job_id: string;
  job_number: string;
  time: string | null;
  time_label: string;
};

export type MachineJobChart = {
  machine_id: string;
  machine_number: string;
  machine_name: string;
  points: MachineJobPoint[];
};

function jobNumberValue(jobNumber: string, index: number): number {
  const digits = jobNumber.replace(/\D/g, "");
  if (digits) return Number(digits);
  return index + 1;
}

export function MachineJobCharts({ charts }: { charts: MachineJobChart[] }) {
  if (charts.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg">Machine jobs</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Open a shift and create jobs to see per-machine charts.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {charts.map((chart) => {
        const values = chart.points.map((p, i) => jobNumberValue(p.job_number, i));
        const maxY = Math.max(...values, 10);
        const niceMax = Math.ceil(maxY / 10) * 10 || 10;
        const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(niceMax * p));

        return (
          <section
            key={chart.machine_id}
            className="rounded-2xl border border-[var(--line)] bg-white p-5"
          >
            <div className="mb-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                {chart.machine_number} · {chart.machine_name}
              </h2>
              <p className="text-sm text-[var(--muted)]">
                Vertical: job number · Horizontal: time
              </p>
            </div>

            {chart.points.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
                No jobs on this machine yet for the open shift.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex min-w-[360px] gap-3">
                  <div className="flex h-48 w-12 shrink-0 flex-col justify-between py-1 text-right text-xs text-[var(--muted)]">
                    {[...ticks].reverse().map((tick) => (
                      <span key={tick}>{tick}</span>
                    ))}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
                      {ticks.map((tick) => (
                        <div key={tick} className="border-t border-[var(--line)]" />
                      ))}
                    </div>
                    <div className="relative flex h-48 items-end gap-3 px-1">
                      {chart.points.map((point, index) => {
                        const value = jobNumberValue(point.job_number, index);
                        const heightPct = Math.max(8, (value / niceMax) * 100);
                        return (
                          <div
                            key={point.job_id}
                            className="flex min-w-[48px] flex-1 flex-col items-center justify-end"
                            title={`${point.job_number} @ ${point.time_label}`}
                          >
                            <span className="mb-1 text-[10px] font-medium text-[var(--ink)]">
                              {point.job_number}
                            </span>
                            <div
                              className="w-full max-w-[44px] rounded-t-md bg-[var(--brand)]"
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-3 px-1">
                      {chart.points.map((point) => (
                        <div
                          key={`${point.job_id}-t`}
                          className="min-w-[48px] flex-1 truncate text-center text-xs text-[var(--muted)]"
                        >
                          {point.time_label}
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

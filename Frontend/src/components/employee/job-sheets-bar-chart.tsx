"use client";

import { formatNumber } from "@/lib/utils";

export type JobSheetBar = {
  job_id: string;
  job_number: string;
  job_name: string;
  total_sheets: number;
  break_sheets: number;
};

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(step * magnitude, 10);
}

/** Brand-matched: deep green (total) + soft gold (break). */
const COLOR_TOTAL = "var(--brand)";
const COLOR_BREAK = "#c4a035";

export function JobSheetsBarChart({ data }: { data: JobSheetBar[] }) {
  const maxSheets = niceMax(
    Math.max(...data.flatMap((d) => [d.total_sheets, d.break_sheets]), 0),
  );
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxSheets * p));

  return (
    <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            Job sheets
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Horizontal: Job No · Vertical: sheets (total vs break)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--ink)]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm ring-1 ring-[var(--ink)]/20"
              style={{ background: COLOR_TOTAL }}
            />
            Total sheets
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm ring-1 ring-[var(--ink)]/20"
              style={{ background: COLOR_BREAK }}
            />
            Break sheets
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--muted)] sm:h-56">
          No open-shift jobs yet. Create a job to see this chart.
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto sm:mx-0">
          <div className="flex min-w-[280px] gap-2 sm:min-w-[420px] sm:gap-3">
            <div className="flex h-48 w-10 shrink-0 flex-col justify-between py-1 text-right text-[10px] text-[var(--muted)] sm:h-56 sm:w-14 sm:text-xs">
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
              <div className="relative flex h-48 items-end gap-2 px-1 pt-4 sm:h-56 sm:gap-4">
                {data.map((item) => {
                  const totalH = Math.max(
                    2,
                    (item.total_sheets / maxSheets) * 100,
                  );
                  const breakH = Math.max(
                    2,
                    (item.break_sheets / maxSheets) * 100,
                  );
                  return (
                    <div
                      key={item.job_id}
                      className="flex h-full min-w-[48px] flex-1 flex-col items-center justify-end sm:min-w-[64px]"
                      title={`${item.job_number}: total ${formatNumber(item.total_sheets)}, break ${formatNumber(item.break_sheets)}`}
                    >
                      <div className="flex h-full w-full max-w-[72px] items-end justify-center gap-1">
                        <div className="relative flex h-full w-[42%] flex-col justify-end">
                          <div
                            className="relative w-full rounded-t-sm ring-1 ring-[var(--ink)]/15"
                            style={{
                              height: `${totalH}%`,
                              minHeight: 4,
                              background: COLOR_TOTAL,
                            }}
                          >
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold leading-none text-[var(--ink)]">
                              {formatNumber(item.total_sheets)}
                            </span>
                          </div>
                        </div>
                        <div className="relative flex h-full w-[42%] flex-col justify-end">
                          <div
                            className="relative w-full rounded-t-sm ring-1 ring-[var(--ink)]/15"
                            style={{
                              height: `${breakH}%`,
                              minHeight: 4,
                              background: COLOR_BREAK,
                            }}
                          >
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold leading-none text-[var(--ink)]">
                              {formatNumber(item.break_sheets)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2 px-1 sm:gap-4">
                {data.map((item) => (
                  <div
                    key={`${item.job_id}-label`}
                    className="min-w-[48px] flex-1 truncate text-center text-[10px] text-[var(--muted)] sm:min-w-[64px] sm:text-xs"
                    title={item.job_name}
                  >
                    {item.job_number}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

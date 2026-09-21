"use client";

import { formatNumber } from "@/lib/utils";

export type WorkerSheetBar = {
  worker_name: string;
  sheets: number;
};

function niceMax(value: number): number {
  if (value <= 0) return 10000;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function ShiftWorkerSheetsChart({
  data,
  shiftName,
}: {
  data: WorkerSheetBar[];
  shiftName?: string | null;
}) {
  const maxSheets = niceMax(Math.max(...data.map((d) => d.sheets), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxSheets * p));

  return (
    <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          Open shift sheets
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {shiftName
            ? `${shiftName} — sheets broken by on-duty workers`
            : "No open shift — chart shows when a shift is open"}
        </p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--muted)]">
          No on-duty worker sheet data yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex min-w-[420px] gap-3">
            <div className="flex h-56 w-14 shrink-0 flex-col justify-between py-1 text-right text-xs text-[var(--muted)]">
              {[...ticks].reverse().map((tick) => (
                <span key={tick}>{formatNumber(tick)}</span>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between py-1">
                {ticks.map((tick) => (
                  <div key={tick} className="border-t border-[var(--line)]" />
                ))}
              </div>

              <div className="relative flex h-56 items-end gap-3 px-1">
                {data.map((item) => {
                  const heightPct = Math.max(2, (item.sheets / maxSheets) * 100);
                  return (
                    <div
                      key={item.worker_name}
                      className="flex min-w-[56px] flex-1 flex-col items-center justify-end"
                      title={`${item.worker_name}: ${formatNumber(item.sheets)} sheets`}
                    >
                      <span className="mb-1 text-[10px] font-medium text-[var(--ink)]">
                        {formatNumber(item.sheets)}
                      </span>
                      <div
                        className="w-full max-w-[52px] rounded-t-md bg-[var(--brand)] transition-[height]"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex gap-3 px-1">
                {data.map((item) => (
                  <div
                    key={`${item.worker_name}-label`}
                    className="min-w-[56px] flex-1 truncate text-center text-xs text-[var(--muted)]"
                    title={item.worker_name}
                  >
                    {item.worker_name}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Horizontal: workers · Vertical: sheets
          </p>
        </div>
      )}
    </section>
  );
}

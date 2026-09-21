import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-white">
      {/* Premium subtle light background atmosphere */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% -10%, rgba(212, 175, 55, 0.12), transparent 70%),
            radial-gradient(ellipse 60% 50% at 85% 60%, rgba(15, 92, 66, 0.05), transparent 60%),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 48px,
              rgba(15, 23, 42, 0.02) 48px,
              rgba(15, 23, 42, 0.02) 49px
            ),
            linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--surface)] to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-4 pb-20 pt-28 md:px-6 md:pb-24 md:pt-32">
        {/* Top Feature Pill */}
        <div className="mb-6 inline-flex max-w-max items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-3.5 py-1.5 text-xs font-semibold text-amber-900 shadow-xs backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Next-Gen Floor Production & Sheet Allocation System
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
          Evershine{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700">
            Trader
          </span>
        </h1>

        <p className="mt-5 max-w-2xl text-lg font-semibold leading-snug text-slate-800 sm:text-xl md:text-2xl">
          Floor production for shifts, jobs, and sheet piles — with hard allocation limits.
        </p>

        <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Open a shift, put workers on duty, create jobs with UPS and Dabbi, record pile
          In/Out, and track remaining sheets across machines — built for tablet use on the floor.
        </p>

        {/* CTA Action Buttons */}
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link href="/login">
            <Button
              size="lg"
              className="bg-[#c4a035] text-slate-950 font-semibold shadow-md hover:bg-[#d4b045] hover:shadow-lg transition-all"
            >
              Login to floor
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button
              size="lg"
              variant="secondary"
              className="border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50 transition-all"
            >
              How it works
            </Button>
          </a>
        </div>

        {/* Hero Feature Highlights Cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-xs backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">Real-time Duty</div>
            <div className="mt-1 text-sm font-bold text-slate-900">Shift & Worker Control</div>
            <div className="mt-0.5 text-xs text-slate-500">Track active duty operators per machine</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-xs backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Auto Limits</div>
            <div className="mt-1 text-sm font-bold text-slate-900">Hard Sheet Bounds</div>
            <div className="mt-0.5 text-xs text-slate-500">Zero over-allocation backend guarantee</div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-xs backdrop-blur-md">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Live Piles</div>
            <div className="mt-1 text-sm font-bold text-slate-900">UPS & Dabbi Tracking</div>
            <div className="mt-0.5 text-xs text-slate-500">Pile In/Out recording per job</div>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      {/* Full-bleed floor atmosphere */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background: `
            linear-gradient(105deg, rgba(10, 32, 24, 0.92) 0%, rgba(15, 92, 66, 0.78) 42%, rgba(10, 32, 24, 0.55) 100%),
            radial-gradient(ellipse 80% 60% at 70% 40%, rgba(196, 160, 53, 0.22), transparent 55%),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 48px,
              rgba(255, 255, 255, 0.03) 48px,
              rgba(255, 255, 255, 0.03) 49px
            ),
            linear-gradient(180deg, #0a2018 0%, #0f5c42 55%, #14201b 100%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--surface)] to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-4 pb-24 pt-28 md:px-6 md:pb-28 md:pt-32">
        <p className="font-[family-name:var(--font-display)] text-4xl leading-none tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Evershine{" "}
          <span className="text-[#c4a035]">Trader</span>
        </p>
        <h1 className="mt-5 max-w-xl text-lg font-medium leading-snug text-white/90 sm:text-xl md:text-2xl">
          Floor production for shifts, jobs, and sheet piles — with hard allocation limits.
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/70 sm:text-base">
          Open a shift, put workers on duty, create jobs with UPS and Dabbi, record pile
          In/Out, and track remaining sheets across machines — built for tablet use on the floor.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/login">
            <Button
              size="lg"
              className="bg-[#c4a035] text-[#14201b] hover:bg-[#d4b045]"
            >
              Login to floor
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button
              size="lg"
              variant="secondary"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              How it works
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

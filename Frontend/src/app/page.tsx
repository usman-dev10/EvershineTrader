import { PublicHeader } from "@/components/layout/brand";
import { LandingHero } from "@/components/landing/hero";
import { LandingSections } from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <PublicHeader />
      <LandingHero />
      <LandingSections />
    </div>
  );
}

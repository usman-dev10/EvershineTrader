import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BrandMark({
  className = "",
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight",
        light ? "text-white" : "text-[var(--ink)]",
        className,
      )}
    >
      Evershine
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <BrandMark light />
        <nav className="hidden items-center gap-8 text-sm text-white/80 md:flex">
          <a href="#how-it-works" className="hover:text-white">
            How it works
          </a>
          <a href="#why" className="hover:text-white">
            Floor features
          </a>
        </nav>
        <Link href="/login">
          <Button
            size="sm"
            className="bg-[#c4a035] text-[#14201b] hover:bg-[#d4b045]"
          >
            Login
          </Button>
        </Link>
      </div>
    </header>
  );
}

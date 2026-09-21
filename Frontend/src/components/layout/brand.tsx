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
        <BrandMark />
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
            How it works
          </a>
          <a href="#why" className="hover:text-slate-900 transition-colors">
            Floor features
          </a>
        </nav>
        <Link href="/login">
          <Button
            size="sm"
            className="bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-sm"
          >
            Login
          </Button>
        </Link>
      </div>
    </header>
  );
}

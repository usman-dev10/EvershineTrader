"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { demoLogout } from "@/lib/auth/demo-logout";
import { cn } from "@/lib/utils";

export type SidebarLink = {
  href: string;
  label: string;
  exact?: boolean;
};

export function AppSidebar({
  links,
  footer,
}: {
  links: SidebarLink[];
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  async function onLogout() {
    await demoLogout();
    router.replace("/login");
    router.refresh();
  }

  function isActive(link: SidebarLink) {
    if (link.exact) return pathname === link.href;
    if (link.href === "/company" || link.href === "/employee") {
      return pathname === link.href;
    }
    return pathname === link.href || pathname.startsWith(`${link.href}/`);
  }

  const nav = (
    <>
      <div className="border-b border-[var(--line)] px-5 py-5">
        <BrandMark />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-medium transition",
              isActive(link)
                ? "bg-[var(--brand-soft)] text-[var(--brand-dark)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="space-y-2 border-t border-[var(--line)] p-3">
        {footer}
        <Link
          href="/account"
          className="block rounded-lg px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)]"
        >
          Account
        </Link>
        <Button variant="secondary" size="sm" className="w-full" onClick={onLogout}>
          Log out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile / tablet top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-white px-4 py-3 lg:hidden">
        <BrandMark />
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink)]"
        >
          <span className="sr-only">Menu</span>
          <span className="flex flex-col gap-1.5">
            <span
              className={cn(
                "block h-0.5 w-5 bg-current transition",
                open && "translate-y-2 rotate-45",
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-5 bg-current transition",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-5 bg-current transition",
                open && "-translate-y-2 -rotate-45",
              )}
            />
          </span>
        </button>
      </div>

      {open ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {/* Drawer on small screens; fixed sidebar on desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-[var(--line)] bg-white transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:shrink-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {nav}
      </aside>
    </>
  );
}

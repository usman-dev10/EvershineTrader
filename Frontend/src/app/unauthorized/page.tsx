import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Unauthorized" };

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--surface)] px-4 text-center">
      <BrandMark />
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Unauthorized
      </h1>
      <p className="max-w-md text-[var(--muted)]">
        You don&apos;t have permission to view this page.
      </p>
      <Link href="/">
        <Button>Go home</Button>
      </Link>
    </div>
  );
}

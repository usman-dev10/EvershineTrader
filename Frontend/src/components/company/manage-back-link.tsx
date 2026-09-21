import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Small back link for manage sub-pages. */
export function ManageBackLink() {
  return (
    <div className="mb-4">
      <Link href="/company/manage">
        <Button variant="ghost" size="sm">
          ← All manage options
        </Button>
      </Link>
    </div>
  );
}

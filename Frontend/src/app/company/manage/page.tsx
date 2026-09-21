import Link from "next/link";
import { PageHeader } from "@/components/ui/page";

const manageOptions = [
  {
    href: "/company/manage/accounts",
    title: "Create Account",
    description: "Create login accounts with phone number and password.",
  },
  {
    href: "/company/manage/employees",
    title: "Employee",
    description: "Add floor employees with CNIC, position, and worker/supervisor role.",
  },
  {
    href: "/company/manage/machines",
    title: "Machines",
    description: "Machines used for jobs and monthly reports.",
  },
];

export const metadata = { title: "Manage" };

export default function ManageHubPage() {
  return (
    <>
      <PageHeader
        title="Manage"
        description="Configure accounts, employees, and machines for your company."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {manageOptions.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-[var(--line)] bg-white p-5 transition hover:border-[var(--brand)] hover:shadow-sm"
          >
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)] group-hover:text-[var(--brand-dark)]">
              {item.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.description}</p>
            <p className="mt-4 text-sm font-medium text-[var(--brand)]">Open →</p>
          </Link>
        ))}
      </div>
    </>
  );
}

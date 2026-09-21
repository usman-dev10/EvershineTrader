import { CompanyShell } from "@/components/layout/company-shell";

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CompanyShell>{children}</CompanyShell>;
}

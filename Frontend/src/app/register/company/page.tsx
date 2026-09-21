import { redirect } from "next/navigation";

/** Company registration disabled — use Create Account after company login. */

export default function CompanyRegisterPage() {
  redirect("/login");
}

/** Bottom line on the ET loader — matches the route being opened. */
export function captionForPath(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/";

  if (path === "/") return "See Evershine Trader...";
  if (path.startsWith("/login")) return "See Login...";
  if (path.startsWith("/unauthorized")) return "See Access...";
  if (path.startsWith("/account")) return "See Account...";

  if (path.includes("/jobs/") && path.endsWith("/workers")) return "See Workers...";
  if (/\/jobs\/[^/]+$/.test(path)) return "See Job...";
  if (path.includes("/jobs")) return "See Jobs...";

  if (path.includes("/sheets")) return "See Sheets...";
  if (path.includes("/shifts/")) return "See Duty...";
  if (path.includes("/shifts")) return "See Shifts...";

  if (path.includes("/machine-report")) return "See Machine Report...";
  if (path.includes("/manage/employees")) return "See Employees...";
  if (path.includes("/manage/machines")) return "See Machines...";
  if (path.includes("/manage/accounts")) return "See Accounts...";
  if (path.includes("/manage")) return "See Manage...";

  if (path === "/employee" || path === "/company") return "See Dashboard...";
  if (path.startsWith("/employee") || path.startsWith("/company")) {
    return "See Dashboard...";
  }

  return "Loading...";
}

/** Caption while a save/update/delete is in progress. */
export function captionForApi(method: string, apiPath: string): string {
  const path = apiPath.toLowerCase();
  const m = method.toUpperCase();

  if (path.includes("pile-out")) return "Saving pile Out...";
  if (path.includes("pile-cancel")) return "Cancelling pile...";
  if (path.includes("/piles") && m === "POST") return "Saving pile In...";
  if (path.includes("/piles") && (m === "PATCH" || m === "DELETE")) {
    return m === "DELETE" ? "Deleting pile..." : "Updating pile...";
  }

  if (path.includes("/jobs") && m === "POST") return "Saving job...";
  if (path.includes("/jobs") && m === "PATCH") return "Updating job...";
  if (path.includes("/jobs") && m === "DELETE") return "Deleting job...";

  if (path.includes("/shifts") && path.includes("/close")) return "Closing shift...";
  if (path.includes("/shifts") && path.includes("/workers") && m === "POST") {
    return "Saving duty...";
  }
  if (path.includes("/shifts") && m === "POST") return "Opening shift...";
  if (path.includes("/shifts") && m === "PATCH") return "Updating shift...";

  if (path.includes("/machines") && m === "POST") return "Saving machine...";
  if (path.includes("/machines") && m === "PATCH") return "Updating machine...";
  if (path.includes("/machines") && m === "DELETE") return "Deleting machine...";

  if (path.includes("/employees") && m === "POST") return "Saving employee...";
  if (path.includes("/employees") && m === "PATCH") return "Updating employee...";
  if (path.includes("/employees") && m === "DELETE") return "Deleting employee...";

  if (path.includes("/accounts") && m === "POST") return "Saving account...";
  if (path.includes("/accounts") && m === "PATCH") return "Updating account...";
  if (path.includes("/accounts") && m === "DELETE") return "Deleting account...";

  if (m === "GET") return "";
  if (m === "DELETE") return "Deleting...";
  if (m === "PATCH" || m === "PUT") return "Updating...";
  if (m === "POST") return "Saving...";
  return "Loading...";
}

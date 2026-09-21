import type { Profile, UserRole } from "@/types/domain";

export const PUBLIC_ROUTES = ["/", "/login"] as const;

export const COMPANY_PREFIX = "/company";
export const EMPLOYEE_PREFIX = "/employee";

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/unauthorized") ||
    pathname.startsWith("/api/auth")
  );
}

export function roleHome(role: UserRole): string {
  return role === "company" ? COMPANY_PREFIX : EMPLOYEE_PREFIX;
}

export function canAccessPath(profile: Profile | null, pathname: string): boolean {
  if (!profile) return isPublicPath(pathname);
  if (pathname.startsWith(COMPANY_PREFIX)) return profile.role === "company";
  if (pathname.startsWith(EMPLOYEE_PREFIX)) return profile.role === "employee";
  return true;
}

export function manageAllowed(role: UserRole): boolean {
  return role === "company";
}

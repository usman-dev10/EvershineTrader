import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/routes";
import type { Profile, UserRole } from "@/types/domain";

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect("/unauthorized");
  return profile;
}

export async function redirectIfAuthenticated(): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile) redirect(roleHome(profile.role));
}

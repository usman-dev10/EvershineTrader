import type { UserRole } from "@/types/domain";
import { DEMO_SESSION_COOKIE } from "@/lib/auth/cookies";

export { DEMO_SESSION_COOKIE };

export type DemoUser = {
  id: string;
  phone: string;
  password: string;
  role: UserRole;
  displayName: string;
};

export const DEMO_USERS: DemoUser[] = [
  {
    id: "demo-company-1",
    phone: "03001234567",
    password: "company123",
    role: "company",
    displayName: "Evershine Company",
  },
  {
    id: "demo-employee-1",
    phone: "03007654321",
    password: "employee123",
    role: "employee",
    displayName: "Floor Operator",
  },
];

export type DemoSession = {
  id: string;
  phone: string;
  role: UserRole;
  displayName: string;
};

export function authenticateDemo(
  phone: string,
  password: string,
): DemoSession | null {
  const normalized = phone.replace(/\D/g, "");
  const user = DEMO_USERS.find(
    (u) => u.phone === normalized && u.password === password,
  );
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    role: user.role,
    displayName: user.displayName,
  };
}

export function encodeDemoSession(session: DemoSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

export function decodeDemoSession(value: string | undefined): DemoSession | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as DemoSession;
    if (!parsed?.id || !parsed?.role || !parsed?.phone) return null;
    if (parsed.role !== "company" && parsed.role !== "employee") return null;
    return parsed;
  } catch {
    return null;
  }
}

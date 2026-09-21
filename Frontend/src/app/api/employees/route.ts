import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/api/backend-proxy";
import { employeeFormSchema } from "@/lib/validations/forms";
import { sanitizeText } from "@/lib/security/sanitize";

export async function GET() {
  const res = await backendFetch("/employees");
  const payload = await res.json();
  return NextResponse.json(payload, { status: res.status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Please complete all required fields." },
      },
      { status: 400 },
    );
  }

  const parsed = employeeFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Please complete all required fields.",
        },
      },
      { status: 400 },
    );
  }

  const payload = {
    full_name: sanitizeText(parsed.data.full_name, 120),
    email: sanitizeText(parsed.data.email, 160).toLowerCase(),
    employee_code: sanitizeText(parsed.data.employee_code, 40),
    phone: parsed.data.phone
      ? sanitizeText(String(parsed.data.phone), 30)
      : null,
    role_permission: parsed.data.role_permission || "standard",
  };

  const res = await backendFetch("/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

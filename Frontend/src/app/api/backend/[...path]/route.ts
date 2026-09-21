import { NextRequest, NextResponse } from "next/server";
import { backendFetch } from "@/lib/api/backend-proxy";

const ALLOWED_PREFIXES = [
  "accounts",
  "employees",
  "workers",
  "machines",
  "supervisors",
  "shifts",
  "jobs",
  "dashboard",
  "companies",
  "reports",
  "floor",
  "auth/logout",
];

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function proxy(request: NextRequest, pathParts: string[]) {
  const path = pathParts.join("/");
  if (!path || !isAllowed(path)) {
    return NextResponse.json(
      { data: null, error: { code: "FORBIDDEN", message: "Path not allowed." } },
      { status: 403 },
    );
  }

  const search = request.nextUrl.search || "";
  const init: RequestInit = { method: request.method };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    if (text) init.body = text;
  }

  const res = await backendFetch(`/${path}${search}`, init);
  const payload = await res.json().catch(() => ({
    data: null,
    error: { code: "PARSE_ERROR", message: "Invalid backend response." },
  }));
  return NextResponse.json(payload, { status: res.status });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

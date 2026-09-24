import { NextResponse } from "next/server";
import {
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
  authenticateDemo,
} from "@/lib/auth/demo";
import { API_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { loginSchema } from "@/lib/validations/forms";
import { getPublicEnv } from "@/lib/env";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect phone number or password.",
        },
      },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect phone number or password.",
        },
      },
      { status: 401 },
    );
  }

  const { phone, password } = parsed.data;
  let apiToken: string | null = null;
  let role: "company" | "employee" | null = null;
  let profileId = "";
  let displayName = "";

  try {
    const env = getPublicEnv();
    const backendRes = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ phone, password }),
    });

    if (backendRes.ok) {
      const payload = await backendRes.json();
      const profile = payload?.data?.profile;
      const session = payload?.data?.session;
      if (profile?.role && session?.access_token) {
        role = profile.role;
        apiToken = session.access_token;
        profileId = String(profile.id);
        displayName =
          role === "company" ? "Evershine Company" : "Floor Operator";
      }
    } else {
      const payload = await backendRes.json().catch(() => null);
      // If user is attempting demo account login when backend returns error/unauthorized
      const demo = authenticateDemo(phone, password);
      if (demo) {
        role = demo.role;
        apiToken = `demo-token-${demo.id}`;
        profileId = demo.id;
        displayName = demo.displayName;
      } else {
        return NextResponse.json(
          {
            error: {
              code: payload?.error?.code ?? "LOGIN_FAILED",
              message:
                payload?.error?.message ??
                `Backend returned status ${backendRes.status}. Please check credentials or backend setup.`,
            },
          },
          { status: backendRes.status },
        );
      }
    }
  } catch {
    // Backend unreachable / offline -> Check if credentials match demo user accounts
    const demo = authenticateDemo(phone, password);
    if (demo) {
      role = demo.role;
      apiToken = `demo-token-${demo.id}`;
      profileId = demo.id;
      displayName = demo.displayName;
    }
  }

  if (!role || !apiToken) {
    return NextResponse.json(
      {
        error: {
          code: "BACKEND_OFFLINE",
          message:
            "Unable to reach backend server. For demo mode, try 03001234567 / company123. For production, set NEXT_PUBLIC_API_BASE_URL in Vercel project environment variables to your hosted backend URL.",
        },
      },
      { status: 503 },
    );
  }

  const demoSession = { id: profileId, phone, role, displayName };
  const response = NextResponse.json({
    data: { profile: demoSession, has_api_token: true },
    error: null,
  });

  response.cookies.set(DEMO_SESSION_COOKIE, encodeDemoSession(demoSession), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.set(API_TOKEN_COOKIE, apiToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}

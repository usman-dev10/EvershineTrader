import { NextResponse } from "next/server";
import { API_TOKEN_COOKIE, DEMO_SESSION_COOKIE } from "@/lib/auth/cookies";

export async function POST() {
  const response = NextResponse.json({ data: null, error: null });
  for (const name of [DEMO_SESSION_COOKIE, API_TOKEN_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

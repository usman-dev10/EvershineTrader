import { cookies } from "next/headers";
import { API_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { getPublicEnv } from "@/lib/env";

export async function getApiAccessToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(API_TOKEN_COOKIE)?.value ?? null;
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getApiAccessToken();
  if (!token) {
    return new Response(
      JSON.stringify({
        data: null,
        error: {
          code: "NO_API_TOKEN",
          message:
            "API session missing. Start the FastAPI backend and log in again as company.",
        },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const env = getPublicEnv();
  const url = `${env.NEXT_PUBLIC_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Network error";
    return new Response(
      JSON.stringify({
        data: null,
        error: {
          code: "BACKEND_OFFLINE",
          message: `Unable to reach backend API (${errorMsg}).`,
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

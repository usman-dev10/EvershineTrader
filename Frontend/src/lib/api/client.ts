import { getPublicEnv } from "@/lib/env";
import { safeErrorMessage } from "@/lib/security/sanitize";
import type { ApiEnvelope } from "@/types/domain";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

function buildHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const env = getPublicEnv();
  const url = `${env.NEXT_PUBLIC_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.token),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    credentials: "omit",
    cache: "no-store",
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(
      "PARSE_ERROR",
      "Unexpected response from server.",
      response.status,
    );
  }

  if (!response.ok || payload.error) {
    const code = payload.error?.code ?? `HTTP_${response.status}`;
    throw new ApiClientError(
      code,
      safeErrorMessage(code, payload.error?.message),
      response.status,
    );
  }

  return payload.data;
}

export function withQuery(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

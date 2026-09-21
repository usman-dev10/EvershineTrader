"use client";

export type ApiEnvelope<T> = {
  data: T;
  error: { code: string; message: string } | null;
};

function messageFromPayload(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    const err = body.error;
    if (err && typeof err === "object" && "message" in err) {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
    const detail = body.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const first = detail[0] as { msg?: string };
      if (first.msg) return first.msg;
    }
  }
  if (status === 401) {
    return "API session missing. Start FastAPI and log in again.";
  }
  return `Request failed (${status}).`;
}

export async function liveApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api/backend${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    throw new Error(
      res.status === 401
        ? "API session missing. Start FastAPI and log in again."
        : `Request failed (${res.status}).`,
    );
  }

  const envelope = payload as ApiEnvelope<T>;
  if (!res.ok || envelope.error) {
    throw new Error(messageFromPayload(payload, res.status));
  }
  return envelope.data;
}

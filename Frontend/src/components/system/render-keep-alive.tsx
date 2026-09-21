"use client";

import { useEffect } from "react";
import { getPublicEnv } from "@/lib/env";

/** Derive /health from NEXT_PUBLIC_API_BASE_URL (.../api/v1 → .../health). */
function healthUrl(apiBase: string): string {
  try {
    return `${new URL(apiBase).origin}/health`;
  } catch {
    return apiBase.replace(/\/api\/v1\/?$/, "") + "/health";
  }
}

/**
 * Pings the FastAPI /health endpoint on an interval so a free Render
 * service is less likely to sleep while someone has the site open.
 * External cron (GitHub Action / UptimeRobot) is still needed when idle.
 */
export function RenderKeepAlive({
  intervalMs = 60_000,
}: {
  intervalMs?: number;
}) {
  useEffect(() => {
    // Only in production / when API is not localhost
    let url: string;
    try {
      url = healthUrl(getPublicEnv().NEXT_PUBLIC_API_BASE_URL);
    } catch {
      return;
    }
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      return;
    }

    let cancelled = false;

    async function ping() {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        await fetch(url, { method: "GET", cache: "no-store", mode: "cors" });
      } catch {
        // Ignore — keep-alive is best-effort
      }
    }

    void ping();
    const id = window.setInterval(() => void ping(), intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void ping();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);

  return null;
}

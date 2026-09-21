"use client";

import { RenderKeepAlive } from "@/components/system/render-keep-alive";

/** Client-only helpers mounted from the root layout. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RenderKeepAlive intervalMs={60_000} />
      {children}
    </>
  );
}

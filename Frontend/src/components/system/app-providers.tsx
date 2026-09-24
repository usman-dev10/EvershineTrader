"use client";

import { EtPageLoader } from "@/components/system/et-page-loader";
import { KeyboardInset } from "@/components/system/keyboard-inset";
import { RenderKeepAlive } from "@/components/system/render-keep-alive";

/** Client-only helpers mounted from the root layout. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <KeyboardInset />
      <EtPageLoader />
      <RenderKeepAlive intervalMs={60_000} />
      {children}
    </>
  );
}
